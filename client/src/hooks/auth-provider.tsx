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
    const checkSession = async () => {
      setIsLoading(true);
      try {
        // First check if we're already authenticated with Replit
        const authResponse = await fetch('/api/auth/check', { 
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!authResponse.ok) {
          console.error('[auth] Auth check failed:', authResponse.status);
          setIsLoading(false);
          setUser(null);
          return;
        }

        let authData;
        try {
          authData = await authResponse.json();
        } catch (e) {
          console.error('[auth] Failed to parse auth check response:', e);
          setIsLoading(false);
          setUser(null);
          return;
        }

        if (!authData?.authenticated) {
          console.log('[auth] Not authenticated');
          setIsLoading(false);
          return;
        }

        // Then get user details
        const response = await apiRequest("GET", `/api/users/me`);
        if (!response.ok) {
          throw new Error('Session invalid');
        }

        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        } else {
          throw new Error('No user data');
        }
      } catch (e) {
        console.log('[auth] Session check failed:', e);
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (userId: string, userRole: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Clear any existing session data first
      localStorage.removeItem("user");

      // Fetch user details using session auth
      const response = await apiRequest("GET", `/api/users/me`);
      if (!response.ok) {
        throw new Error("فشل تسجيل الدخول - يرجى المحاولة مرة أخرى");
      }

      const data = await response.json();
      if (!data.user) {
        throw new Error("خطأ في جلب بيانات المستخدم");
      }

      // Save user to state and localStorage
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (error: any) {
      console.error('[auth] Login error:', error);
      setError(error.message || "حدث خطأ أثناء تسجيل الدخول");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (!user) {
      console.log("[auth] No user in state, skipping refresh");
      return;
    }

    try {
      console.log("[auth] Refreshing user data...");
      const response = await apiRequest("GET", `/api/users/me`);

      if (!response.ok) {
        console.log("[auth] Session expired or invalid, logging out");
        logout();
        return;
      }

      const data = await response.json();
      console.log("[auth] Server response:", data);

      if (data.user) {
        console.log("[auth] Updating user state with:", data.user);
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
    throw new Error("يجب استخدام useAuth داخل AuthProvider");
  }
  return context;
}