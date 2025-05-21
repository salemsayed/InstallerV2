import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/auth-provider';

export function LogoutButton({ 
  variant = 'default',
  className = ''
}: { 
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link',
  className?: string 
}) {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Force fallback logout
      window.location.href = "/auth/logout";
    }
  };
  
  return (
    <Button 
      variant={variant} 
      className={className}
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? 'جاري تسجيل الخروج...' : 'تسجيل الخروج'}
    </Button>
  );
}

export function LogoutPage() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // This page serves as a dedicated logout mechanism
  // that will forcibly terminate the session
  useEffect(() => {
    const performLogout = async () => {
      try {
        // First, try to call the regular logout method
        await logout();
      } catch (error) {
        console.error("Error during logout:", error);
        setError("حدث خطأ أثناء تسجيل الخروج. سيتم توجيهك إلى صفحة تسجيل الدخول.");
      }
      
      // Force-clear all storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all possible cookies
      const cookieNames = ["sid", "connect.sid", "bareeq.sid"];
      const paths = ["/", "/auth", "/api", ""];
      
      // Clear cookies for all possible paths
      cookieNames.forEach(name => {
        paths.forEach(path => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path || '/'};`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path || '/'}; secure; samesite=none;`;
        });
      });
      
      // Give it time for session termination
      setTimeout(() => {
        // Force a fresh page load
        window.location.href = '/auth/login?fresh=' + Date.now();
      }, 1000);
    };
    
    performLogout();
  }, [logout, setLocation]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50">
      <div className="text-2xl font-bold mb-4">تسجيل الخروج</div>
      {error ? (
        <div className="text-red-500 mb-4">{error}</div>
      ) : (
        <div className="mb-4">جاري تسجيل الخروج...</div>
      )}
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}