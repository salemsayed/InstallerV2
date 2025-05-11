import { useEffect } from "react";
import { useLocation } from "wouter";
import PhoneLoginForm from "@/components/auth/phone-login-form";
import AuthLayout from "@/components/layouts/auth-layout";
import { useAuth } from "@/hooks/auth-provider";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, login } = useAuth();

  // If user is already logged in, redirect to appropriate page
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/installer/home");
      }
    }
  }, [user, navigate]);

  const handleLoginSuccess = (userId: number, userRole: string) => {
    // In a production app, you would set cookies, tokens, etc.
    // For now, we'll simply use the userId to fetch user data
    login(userId.toString(), userRole);
    
    // Redirect based on role
    if (userRole === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/installer/home");
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col md:flex-row w-full gap-8 items-center">
        <div className="w-full md:w-1/2 order-2 md:order-1">
          <PhoneLoginForm onSuccess={handleLoginSuccess} />
        </div>
        
        <div className="w-full md:w-1/2 text-right order-1 md:order-2 p-6">
          <div className="mb-8 flex justify-center md:justify-end">
            <img 
              src="/images/breeg-logo.png" 
              alt="بريق" 
              className="h-16 w-auto"
            />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">مرحباً بك في برنامج مكافآت بريق</h1>
          
          <p className="text-muted-foreground mb-6">
            برنامج مكافآت بريق هو برنامج مخصص للفنيين والمركبين لمكافأتهم على تميزهم في العمل ومساهمتهم في نجاح العلامة التجارية.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-right">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">اكسب النقاط</h3>
                <p className="text-sm text-muted-foreground">
                  اكسب نقاط مع كل تركيب أو صيانة أو مشاركة في التدريب
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 text-right">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M12 13V7"></path><circle cx="12" cy="17" r="1"></circle>
                  <path d="M12.5 20h-1c-1.5 0-3-2-3-6 0-2 1-3 3-3h1c2 0 3 1 3 3 0 4-1.5 6-3 6Z"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">ارتقِ في المستويات</h3>
                <p className="text-sm text-muted-foreground">
                  كلما زادت نقاطك، ارتقيت في المستويات وحصلت على مزايا أكبر
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 text-right">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M6 19V5c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v14"></path>
                  <path d="M6 9h12"></path><path d="M6 17h12"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">تابع تقدمك</h3>
                <p className="text-sm text-muted-foreground">
                  تابع تقدمك وإنجازاتك من خلال التطبيق بطريقة سهلة وبسيطة
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}