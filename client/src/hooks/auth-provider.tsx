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
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Verify the user is still valid from the server using secure session
        // The server will use the session cookie instead of query parameters
        apiRequest("GET", `/api/users/me`)
          .then(res => res.json())
          .then(data => {
            if (data.user) {
              setUser(data.user);
            } else {
              // If user is not valid, clear local storage
              localStorage.removeItem("user");
              setUser(null);
            }
          })
          .catch(() => {
            // If error, assume session expired
            localStorage.removeItem("user");
            setUser(null);
          });
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (userId: string, userRole: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch user details using secure session - no query params needed
      const response = await apiRequest("GET", `/api/users/me`);
      const data = await response.json();
      
      if (data.user) {
        // Save user to state and localStorage
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
        return Promise.resolve(); // Explicitly resolve the promise on success
      } else {
        setError("خطأ في جلب بيانات المستخدم");
        return Promise.reject(new Error("خطأ في جلب بيانات المستخدم"));
      }
    } catch (error: any) {
      setError(error.message || "حدث خطأ أثناء تسجيل الدخول");
      return Promise.reject(error);
    } finally {
      setIsLoading(false);
    }
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
      // Call the server to invalidate the session
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      // Always clear local state even if server request fails
      setUser(null);
      localStorage.removeItem("user");
      setLocation("/");
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