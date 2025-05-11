import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import AuthLayout from "@/components/layouts/auth-layout";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      setStatus("success");
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك في برنامج مكافآت بريق",
      });
      
      // Redirect based on user role
      const redirectPath = user.role === "admin" 
        ? "/admin/dashboard" 
        : "/installer/dashboard";
        
      setTimeout(() => {
        setLocation(redirectPath);
      }, 1500);
    } else {
      setStatus("error");
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.",
      });
    }
  }, [isLoading, isAuthenticated, user, setLocation, toast]);

  return (
    <AuthLayout>
      <Card className="bg-white rounded-2xl shadow-lg border-0">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold text-center mb-6">برنامج مكافآت بريق</h1>
          
          {status === "loading" && (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
              <p className="text-neutral-600">جاري تسجيل الدخول...</p>
            </div>
          )}
          
          {status === "success" && (
            <div className="text-center py-8">
              <div className="text-green-500 text-5xl mb-4">✓</div>
              <p className="text-neutral-600">تم تسجيل الدخول بنجاح!</p>
              <p className="text-neutral-500 text-sm mt-2">جاري تحويلك...</p>
            </div>
          )}
          
          {status === "error" && (
            <div className="text-center py-8">
              <div className="text-red-500 text-5xl mb-4">✗</div>
              <p className="text-neutral-600">فشل تسجيل الدخول</p>
              <p className="text-neutral-500 text-sm mt-2">
                <a href="/" className="text-primary hover:underline">العودة إلى صفحة تسجيل الدخول</a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}