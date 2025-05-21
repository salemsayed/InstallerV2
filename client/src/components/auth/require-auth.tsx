import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import arOnlyLogo from "@assets/AR-Only.png";

interface RequireAuthProps {
  children: ReactNode;
  role?: string;
}

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, isLoading, refreshUser } = useAuth();
  const [location, setLocation] = useLocation();

  // Force a refresh of user data when the component mounts
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Check if user is authenticated and has the required role (if specified)
  const isAuthenticated = !!user;
  const hasRequiredRole = role ? user?.role === role : true;

  // Only redirect to login if explicitly not authenticated (after checking with server)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== '/') {
      // This prevents redirect loops - only redirect if we're not already on the login page
      // and we've confirmed with the server that we're not authenticated
      setLocation('/');
    }
  }, [isLoading, isAuthenticated, setLocation, location]);

  // If still loading, show a loading spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, don't render anything as we're redirecting
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authenticated but wrong role, show error message
  if (!hasRequiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={arOnlyLogo} alt="بريق" className="h-16" />
            </div>
            <CardTitle className="text-xl">خطأ في الصلاحيات</CardTitle>
            <CardDescription>
              ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              حسابك ليس لديه الصلاحيات المطلوبة لعرض هذه الصفحة.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              className="w-full"
              onClick={() => setLocation('/')}
            >
              العودة إلى صفحة تسجيل الدخول
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // If authenticated and has required role, render children
  return <>{children}</>;
}