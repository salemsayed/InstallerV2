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
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Check if user is authenticated and has the required role (if specified)
  const isAuthenticated = !!user;
  const hasRequiredRole = role ? user?.role === role : true;
  
  // Redirect to login page if not authenticated or lacking required role
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !hasRequiredRole)) {
      // We don't redirect here immediately to show the error message
    }
  }, [isLoading, isAuthenticated, hasRequiredRole, setLocation]);

  // If still loading, show a loading spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authenticated and has required role, render children
  if (isAuthenticated && hasRequiredRole) {
    return <>{children}</>;
  }

  // If not authenticated or doesn't have required role, show error message
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={arOnlyLogo} alt="بريق" className="h-16" />
          </div>
          <CardTitle className="text-xl">يجب تسجيل الدخول</CardTitle>
          <CardDescription>
            {!isAuthenticated 
              ? 'لم يتم تسجيل دخولك. يرجى تسجيل الدخول للوصول إلى هذه الصفحة.'
              : 'ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            {!isAuthenticated 
              ? 'جلسة تسجيل الدخول الخاصة بك انتهت أو قمت بالوصول مباشرة إلى صفحة محمية.'
              : 'حسابك ليس لديه الصلاحيات المطلوبة لعرض هذه الصفحة.'}
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