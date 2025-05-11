import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  points: number;
  level: number;
  region?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string) => Promise<{ success: boolean; token?: string; email?: string }>;
  verifyToken: (token: string, email: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  error: null,
  login: async () => ({ success: false }),
  verifyToken: async () => false,
  logout: () => {}
});

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

  const login = async (email: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email });
      const data = await res.json();
      
      if (data.success) {
        return {
          success: true,
          token: data.token,
          email: data.email
        };
      } else {
        setError(data.message || "حدث خطأ أثناء تسجيل الدخول");
        return { success: false };
      }
    } catch (e: any) {
      setError(e.message || "حدث خطأ أثناء تسجيل الدخول");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyToken = async (token: string, email: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest("POST", "/api/auth/verify", { token, email });
      const data = await res.json();
      
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Redirect based on role
        if (data.user.role === UserRole.ADMIN) {
          setLocation("/admin/dashboard");
        } else {
          setLocation("/installer/dashboard");
        }
        
        return true;
      } else {
        setError(data.message || "فشل التحقق من الرمز");
        return false;
      }
    } catch (e: any) {
      setError(e.message || "فشل التحقق من الرمز");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setLocation("/");
  };

  const contextValue = {
    user,
    isLoading,
    error,
    login,
    verifyToken,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}