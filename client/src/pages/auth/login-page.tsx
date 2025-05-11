import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/auth-provider";
import PhoneLoginForm from "@/components/auth/phone-login-form";
import AuthLayout from "@/components/layouts/auth-layout";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import logoPath from "@assets/AR-Only.png";

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        setLocation("/admin/dashboard");
      } else {
        setLocation("/installer/dashboard");
      }
    }
  }, [user, setLocation]);

  const handleLoginSuccess = (userId: number, userRole: string) => {
    login(userId.toString(), userRole);
    
    if (userRole === "admin") {
      setLocation("/admin/dashboard");
    } else {
      setLocation("/installer/dashboard");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col-reverse md:flex-row rtl h-full min-h-[90vh]">
        {/* Login Form */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <PhoneLoginForm onSuccess={handleLoginSuccess} />
        </div>

        {/* Hero Section */}
        <div className="flex-1 bg-gradient-to-b from-primary/90 to-primary flex flex-col items-center justify-center p-8 text-white">
          <div className="mb-8">
            <img 
              src={logoPath} 
              alt="برنامج مكافات بريق" 
              className="h-24 md:h-32 object-contain"
            />
          </div>
          <Card className="bg-white/10 backdrop-blur-sm p-6 rounded-lg max-w-md shadow-lg border-0">
            <h1 className="text-2xl md:text-4xl font-bold mb-4 text-center">
              برنامج مكافات بريق
            </h1>
            <p className="text-lg text-center mb-6">
              نظام المكافآت الخاص بفنيي التركيب
            </p>
            <ul className="space-y-3 text-sm md:text-base">
              <li className="flex rtl items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/20 text-white mr-2 text-xs">1</span>
                <span>تسجيل عمليات التركيب وكسب النقاط</span>
              </li>
              <li className="flex rtl items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/20 text-white mr-2 text-xs">2</span>
                <span>متابعة نقاطك ومستوى الإنجاز</span>
              </li>
              <li className="flex rtl items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/20 text-white mr-2 text-xs">3</span>
                <span>جمع الشارات ومتابعة تقدمك</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AuthLayout>
  );
}