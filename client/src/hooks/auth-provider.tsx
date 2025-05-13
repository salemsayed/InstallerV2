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
        
        // Verify the user is still valid from the server
        // This would check a session or token in a real app
        apiRequest("GET", `/api/users/me?userId=${parsedUser.id}`)
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
            // If error, assume token expired
            localStorage.removeItem("user");
            setUser(null);
          });
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userId: string, userRole: string) => {
    setIsLoading(true);
    setError(null);
    
    // Fetch user details
    apiRequest("GET", `/api/users/me?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          // Save user to state and localStorage
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        } else {
          setError("خطأ في جلب بيانات المستخدم");
        }
      })
      .catch(error => {
        setError(error.message || "حدث خطأ أثناء تسجيل الدخول");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const refreshUser = async (): Promise<void> => {
    if (!user) return;
    
    try {
      const response = await apiRequest("GET", `/api/users/me?userId=${user.id}`);
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setLocation("/");
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}