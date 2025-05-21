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
  
  const handleLogout = () => {
    setIsLoggingOut(true);
    try {
      // Most basic, direct approach possible:
      // 1. Clear client storage
      localStorage.clear();
      sessionStorage.clear();
      
      // 2. Create an invisible form to POST to logout
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/auth/logout';
      form.style.display = 'none';
      
      // Add a timestamp to prevent caching
      const timeField = document.createElement('input');
      timeField.type = 'hidden';
      timeField.name = 'timestamp';
      timeField.value = Date.now().toString();
      form.appendChild(timeField);
      
      // Append to body and submit
      document.body.appendChild(form);
      form.submit();
      
      // This is the most reliable approach because:
      // - It performs a full page submission, not an AJAX request
      // - It causes a complete page reload after server processes logout
      // - It avoids any CORS/credentials issues that can occur with fetch
    } catch (error) {
      console.error("Basic logout failed:", error);
      
      // Extreme fallback - just go to login
      window.location.href = "/?force=1&t=" + Date.now();
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
  const [error, setError] = useState<string | null>(null);
  
  // This dedicated logout page handles complete session termination
  useEffect(() => {
    const performForceLogout = async () => {
      try {
        console.log("[FORCE-LOGOUT] Beginning complete logout process");
        
        // 1. Clear all browser storage
        try {
          localStorage.clear();
          sessionStorage.clear();
          
          // Also clear specific items in case clear() fails
          const keysToRemove = [
            "user", "auth_user_data", "temp_user_id", "temp_user_role", 
            "auth_phone", "auth_otp", "auth_timestamp", "last_login"
          ];
          
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          });
          
          console.log("[FORCE-LOGOUT] Storage cleared");
        } catch (e) {
          console.error("[FORCE-LOGOUT] Error clearing storage:", e);
        }
        
        // 2. Aggressive cookie clearing across all paths and domains
        try {
          const cookieNames = [
            "sid", "connect.sid", "bareeq.sid", 
            "express.sid", "express:sess", "express:sess.sig"
          ];
          
          const paths = ["/", "/auth", "/api", "/installer", "/admin", ""];
          
          // Use multiple cookie-clearing techniques for different browsers
          cookieNames.forEach(name => {
            paths.forEach(path => {
              // Standard clearing
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path || '/'};`;
              
              // For secure cross-site cookies
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path || '/'}; secure; samesite=none;`;
              
              // Max-age approach
              document.cookie = `${name}=; max-age=0; path=${path || '/'};`;
              
              // Simple approach that works in some browsers
              document.cookie = `${name}=;`;
            });
          });
          
          console.log("[FORCE-LOGOUT] Cookies cleared");
        } catch (e) {
          console.error("[FORCE-LOGOUT] Error clearing cookies:", e);
        }
        
        // 3. Call server-side logout endpoint with multiple approaches
        try {
          // Make multiple parallel attempts with different settings
          const results = await Promise.allSettled([
            // Standard approach
            fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
              cache: "no-cache",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache"
              }
            }),
            
            // With explicit authentication header
            fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
              cache: "no-cache",
              headers: {
                "X-Auth-Force-Logout": "true"
              }
            })
          ]);
          
          console.log("[FORCE-LOGOUT] Server logout attempts completed:", 
            results.map(r => r.status === 'fulfilled' ? 'success' : 'failed').join(', '));
        } catch (e) {
          console.error("[FORCE-LOGOUT] Error calling server logout:", e);
        }
        
        // 4. Final step - force a complete page reload to the login page
        console.log("[FORCE-LOGOUT] Redirecting to login page");
        
        // Give a small delay to ensure all async operations have a chance to complete
        setTimeout(() => {
          // Use window.location.replace to prevent back button from returning to dashboard
          window.location.replace(`/auth/login?fresh=${Date.now()}`);
        }, 1000);
        
      } catch (error) {
        console.error("[FORCE-LOGOUT] Unexpected error in logout process:", error);
        setError("حدث خطأ أثناء تسجيل الخروج. سيتم توجيهك إلى صفحة تسجيل الدخول.");
        
        // Even on error, force navigation to login
        setTimeout(() => {
          window.location.replace(`/auth/login?error=1&t=${Date.now()}`);
        }, 1000);
      }
    };
    
    // Start the logout process immediately when this component mounts
    performForceLogout();
    
    // If for some reason the logout process gets stuck, set a fail-safe timer
    const failSafeTimer = setTimeout(() => {
      console.log("[FORCE-LOGOUT] Fail-safe timer triggered");
      window.location.replace(`/auth/login?failsafe=1&t=${Date.now()}`);
    }, 5000);
    
    // Clean up the failsafe timer if the component unmounts
    return () => clearTimeout(failSafeTimer);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50">
      <div className="text-2xl font-bold mb-4">تسجيل الخروج</div>
      {error ? (
        <div className="text-red-500 mb-4">{error}</div>
      ) : (
        <div className="mb-4">جاري تسجيل الخروج... سيتم توجيهك إلى صفحة تسجيل الدخول</div>
      )}
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}