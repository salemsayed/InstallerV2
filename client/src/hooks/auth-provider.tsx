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
      // Use secure session-based authentication - no query params needed
      const response = await apiRequest("GET", `/api/users/me`);
      const data = await response.json();
      
      if (data.user) {
        // Update user state with fresh data from server
        setUser(data.user);
        // Also update localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        console.log("User data refreshed:", data.user);
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  };

  const logout = async () => {
    try {
      console.log("[AUTH] Logout initiated");
      // Clear all client-side state first
      setUser(null);
      localStorage.removeItem("user");
      
      // Call the server to invalidate the session - use fetch directly to avoid 
      // any issues with the apiRequest utility in the logout flow
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include" // Important to include cookies
      });
      
      if (response.ok) {
        console.log("[AUTH] Server session invalidated successfully");
      } else {
        console.error("[AUTH] Error invalidating server session:", await response.text());
      }
    } catch (error) {
      console.error("[AUTH] Error during logout:", error);
    } finally {
      // Redirect to login page
      console.log("[AUTH] Redirecting to login page after logout");
      
      // Force reload the page to clear any lingering state
      window.location.href = "/";
    }
  };

  // Set up auto-refresh for user data
  useEffect(() => {
    if (!user) return;
    
    // Refresh user data every 2 seconds
    const intervalId = setInterval(() => {
      refreshUser();
    }, 2000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
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