import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  points: number;
  level: number;
  region?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (userId: string, userRole: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Check if user is logged in on initial load
  useEffect(() => {
    console.log("[AUTH] Initializing auth state");
    
    // Always check server-side session first
    const checkServerSession = async () => {
      setIsLoading(true);
      
      try {
        console.log("[AUTH] Checking server session");
        const response = await fetch('/api/users/me', {
          credentials: 'include', // Critical for session cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            console.log("[AUTH] Valid session found:", data.user.name);
            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));
            setIsLoading(false);
            return;
          }
        }
        
        // If no valid server session, try local storage as fallback
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            console.log("[AUTH] No server session, trying localStorage");
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            
            // Make a second attempt to validate with server
            const validationResponse = await apiRequest("GET", `/api/users/me`);
            const validationData = await validationResponse.json();
            
            if (validationData.user) {
              console.log("[AUTH] Session valid after retry");
              setUser(validationData.user);
            } else {
              console.log("[AUTH] Invalid session after retry, clearing");
              localStorage.removeItem("user");
              setUser(null);
            }
          } catch (e) {
            console.error("[AUTH] Error parsing stored user:", e);
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          console.log("[AUTH] No authentication found");
          setUser(null);
        }
      } catch (error) {
        console.error("[AUTH] Error during initial auth check:", error);
        // Clear any potentially stale data
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkServerSession();
  }, []);

  const login = async (userId: string, userRole: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    console.log("[AUTH] Login called with userId:", userId, "userRole:", userRole);
    
    // We need to make multiple attempts to get user data as the session might take time to propagate
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second between retries
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[AUTH] Attempt ${attempt} to fetch user data`);
        
        // Wait before each attempt to give the server time to establish the session
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
        // Fetch user details using secure session - no query params needed
        const response = await fetch('/api/users/me', {
          credentials: 'include',
          cache: 'no-cache', // Prevent caching issues
        });
        
        if (!response.ok) {
          console.warn(`[AUTH] Attempt ${attempt} failed with status ${response.status}`);
          if (attempt === MAX_RETRIES) {
            throw new Error(`Failed to fetch user data after ${MAX_RETRIES} attempts`);
          }
          continue; // Try again
        }
        
        const data = await response.json();
        
        if (data.user) {
          console.log("[AUTH] Successfully retrieved user data on attempt", attempt);
          // Save user to state and localStorage
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
          setIsLoading(false);

          // Handle role-based redirection
          if (data.user.role === 'ADMIN') {
            setLocation('/admin/dashboard');
          } else if (data.user.role === 'INSTALLER') {
            setLocation('/installer/dashboard');
          }
          return; // Success - exit the retry loop
        } else {
          console.warn(`[AUTH] User data not found in response on attempt ${attempt}`);
        }
      } catch (error: any) {
        console.error(`[AUTH] Error in login attempt ${attempt}:`, error);
        
        if (attempt === MAX_RETRIES) {
          setError(error.message || "حدث خطأ أثناء تسجيل الدخول");
          setIsLoading(false);
          throw error; // Only throw after all attempts fail
        }
      }
    }
    
    // If we get here, all attempts failed but didn't throw an error
    setError("فشل في جلب بيانات المستخدم بعد عدة محاولات");
    setIsLoading(false);
    throw new Error("Failed to retrieve user data after multiple attempts");
  };

  const refreshUser = async (): Promise<void> => {
    if (!user) return;
    
    try {
      console.log("[AUTH] Refreshing user data");
      
      // Use fetch directly with proper options for session authentication
      const response = await fetch('/api/users/me', {
        credentials: 'include',
        cache: 'no-cache', // Always get fresh data
      });
      
      if (!response.ok) {
        console.warn(`[AUTH] Refresh failed with status ${response.status}`);
        
        // If we get an auth error during refresh, the session may be invalid
        if (response.status === 401 || response.status === 403) {
          console.error("[AUTH] Session invalid during refresh, logging out");
          // Clear local state but don't redirect yet
          localStorage.removeItem("user");
          setUser(null);
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.user) {
        // Update user state with fresh data from server
        setUser(data.user);
        // Also update localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        console.log("[AUTH] User data refreshed successfully");
      } else {
        console.warn("[AUTH] User data missing in refresh response");
      }
    } catch (error) {
      console.error("[AUTH] Error refreshing user data:", error);
    }
  };

  const logout = async () => {
    try {
      console.log("[AUTH] Logout initiated");
      
      // Clear client-side state first to prevent any further authenticated requests
      setUser(null);
      localStorage.removeItem("user");
      sessionStorage.clear();
      
      // Stop the auto-refresh interval
      const win = window as any; // Type assertion for custom property
      if (win._authRefreshInterval) {
        clearInterval(win._authRefreshInterval);
        win._authRefreshInterval = null;
      }
      
      // Call the server to invalidate the session
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-cache",
        });
        
        if (response.ok) {
          console.log("[AUTH] Server session invalidated successfully");
        } else {
          console.warn("[AUTH] Server logout returned status:", response.status);
        }
      } catch (fetchError) {
        console.error("[AUTH] Error calling logout endpoint:", fetchError);
      }
      
      // Try to clear cookies every way possible to ensure they're gone
      // Clear for root path
      document.cookie = "connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "bareeq.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Force navigation to login page after a delay to ensure everything is cleared
      console.log("[AUTH] Redirecting to login page");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 200);
      
    } catch (error) {
      console.error("[AUTH] Unexpected error during logout:", error);
      
      // Even on error, force logout by clearing everything and redirecting
      setUser(null);
      localStorage.removeItem("user");
      window.location.href = "/auth/login";
    }
  };

  // Set up auto-refresh for user data
  useEffect(() => {
    if (!user) return;
    
    console.log("[AUTH] Setting up auto-refresh for user data");
    
    // Store interval ID in a global variable so we can clear it on logout
    // We need to typeset the window object to access our custom property
    const win = window as any;
    
    // Clear any existing refresh interval to prevent duplicates
    if (win._authRefreshInterval) {
      clearInterval(win._authRefreshInterval);
    }
    
    // Refresh user data every 15 seconds (less aggressive to reduce network load)
    win._authRefreshInterval = setInterval(() => {
      refreshUser();
    }, 15000);
    
    // Clean up interval on unmount
    return () => {
      if (win._authRefreshInterval) {
        clearInterval(win._authRefreshInterval);
        win._authRefreshInterval = null;
      }
    };
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("يجب استخدام useAuth داخل AuthProvider");
  }
  return context;
}