import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  name: string;
  email?: string; // Make email optional since it's not always present
  phone?: string;
  role: string;
  points: number;
  level: number;
  region?: string;
  status?: string;
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
    
    // Try using auth data stored by the login form (if available)
    const storedAuthData = localStorage.getItem("auth_user_data");
    if (storedAuthData) {
      try {
        const authUser = JSON.parse(storedAuthData);
        console.log("[AUTH] Using stored auth data", authUser.name);
        
        // Create direct user object for immediate login
        const directUser = {
          id: authUser.id || parseInt(userId),
          name: authUser.name || `User ${userId}`,
          role: authUser.role || userRole,
          phone: authUser.phone || "",
          points: authUser.points || 0,
          level: authUser.level || 1,
          region: authUser.region || ""
        };
        
        // Immediately set the user in state for UI display
        setUser(directUser);
        localStorage.setItem("user", JSON.stringify(directUser));
        
        // Handle role-based redirection
        if (directUser.role.toLowerCase().includes('admin')) {
          setLocation('/admin/dashboard');
        } else {
          setLocation('/installer/dashboard');
        }
        
        setIsLoading(false);
        return;
      } catch (error) {
        console.error("[AUTH] Error parsing stored auth data:", error);
        // Continue with regular login if stored data fails
      }
    }
    
    // URL parameter-based authentication for deployment environments
    const authUrl = `/api/users/me-direct?userId=${userId}&userRole=${userRole}&ts=${Date.now()}`;
    
    try {
      console.log(`[AUTH] Using direct URL authentication`);
      
      // Make a single direct request with auth in URL parameters
      const response = await fetch(authUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
          'X-Auth-User-Id': userId,
          'X-Auth-User-Role': userRole
        }
      });
      
      // If successful, use the response directly
      if (response.ok) {
        const data = await response.json();
        
        if (data.user) {
          console.log("[AUTH] Successfully retrieved user data via direct auth");
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
          setIsLoading(false);
          
          // Handle role-based redirection
          if (data.user.role.toLowerCase().includes('admin')) {
            setLocation('/admin/dashboard');
          } else {
            setLocation('/installer/dashboard');
          }
          return;
        }
      } else {
        console.warn(`[AUTH] Direct auth failed with status ${response.status}`);
      }
      
      // Fallback to a basic user object if all else fails
      console.log("[AUTH] All auth methods failed, using basic fallback user object");
      const fallbackUser = {
        id: parseInt(userId),
        name: `User ${userId}`,
        role: userRole,
        phone: "",
        points: 0,
        level: 1,
        region: ""
      };
      
      setUser(fallbackUser);
      localStorage.setItem("user", JSON.stringify(fallbackUser));
      setIsLoading(false);
      
      // Handle role-based redirection
      if (userRole.toLowerCase().includes('admin')) {
        setLocation('/admin/dashboard');
      } else {
        setLocation('/installer/dashboard');
      }
      
    } catch (error: any) {
      console.error(`[AUTH] Error in login:`, error);
      setError(error.message || "حدث خطأ أثناء تسجيل الدخول");
      setIsLoading(false);
      throw error;
    }
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
      
      // Clear client-side state immediately
      setUser(null);
      
      // Clear all storage to ensure complete logout
      localStorage.clear();
      sessionStorage.clear();
      
      // Remove all specific authentication-related data
      const keysToRemove = [
        "user", "auth_user_data", "temp_user_id", "temp_user_role", 
        "auth_phone", "auth_otp", "auth_timestamp", "last_login",
        "session_id", "auth_state", "auth_method"
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Stop the auto-refresh interval
      const win = window as any; // Type assertion for custom property
      if (win._authRefreshInterval) {
        clearInterval(win._authRefreshInterval);
        win._authRefreshInterval = null;
      }
      
      // Try multiple server-side logout attempts with different fetch options
      const logoutEndpoints = [
        "/api/auth/logout",
        "/auth/logout"
      ];
      
      // Try all logout endpoints in parallel for redundancy
      await Promise.allSettled(
        logoutEndpoints.map(endpoint => 
          fetch(endpoint, {
            method: "POST",
            credentials: "include",
            cache: "no-cache",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "X-Auth-Force-Logout": "true"
            }
          })
        )
      );
      
      // Comprehensive cookie clearing for all possible domains and paths
      const cookieNames = [
        "sid", "connect.sid", "bareeq.sid", 
        "express.sid", "express:sess", "express:sess.sig",
        "_csrf", "XSRF-TOKEN"
      ];
      
      const paths = ["/", "/auth", "/api", "/installer", "/admin", ""];
      
      // Clear cookies with multiple techniques
      cookieNames.forEach(name => {
        paths.forEach(path => {
          // Method 1: Standard clearing
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path || '/'};`;
          
          // Method 2: With secure and SameSite none (for cross-site cookies)
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path || '/'}; secure; samesite=none;`;
          
          // Method 3: With explicit max-age
          document.cookie = `${name}=; max-age=0; path=${path || '/'};`;
          
          // Method 4: Empty with nothing else (some browsers accept this)
          document.cookie = `${name}=;`;
        });
      });
      
      console.log("[AUTH] Storage and cookie clearing complete");
      
      // Final step: Use the hardcoded logout page that performs a browser-level redirect
      // This ensures all auth state is reset completely, including browser cache
      console.log("[AUTH] Redirecting to dedicated logout page");
      
      // Use setTimeout to ensure all async operations have a chance to complete
      setTimeout(() => {
        // Force a navigation to our dedicated logout page
        // This will handle clearing everything and redirecting to login
        window.location.href = "/auth/logout?t=" + Date.now();
      }, 100);
      
    } catch (error) {
      console.error("[AUTH] Unexpected error during logout:", error);
      
      // Even on error, force logout with hardest possible page reload
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      
      // Navigate to our dedicated logout page as failsafe
      window.location.href = "/auth/logout?t=" + Date.now();
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