import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";

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
    
    console.log("Logging in user:", userId, userRole);
    
    // Create a minimal user object to ensure navigation works immediately
    const minimalUser = {
      id: parseInt(userId),
      role: userRole,
      name: "مستخدم",
      email: "",
      phone: "",
      status: "active",
      points: 0,
      level: 1,
      createdAt: new Date().toISOString()
    };
    
    // Store minimal user info immediately to prevent navigation issues
    setUser(minimalUser);
    localStorage.setItem("user", JSON.stringify(minimalUser));
    
    // Then fetch complete user details
    apiRequest("GET", `/api/users/me?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        console.log("User data fetched:", data);
        if (data && data.user) {
          // Save complete user to state and localStorage
          const fullUser = data.user;
          console.log("Setting full user data:", fullUser);
          setUser(fullUser);
          localStorage.setItem("user", JSON.stringify(fullUser));
        } else {
          console.log("User data not found in response, keeping minimal user");
          // Keep using the minimal user if the API doesn't return proper data
        }
      })
      .catch(error => {
        console.error("Error fetching user details:", error);
        // Don't show error to user or clear current minimal user
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setLocation("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout
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