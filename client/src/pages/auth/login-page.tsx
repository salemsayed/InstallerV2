import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/auth-provider";
import PhoneLoginForm from "@/components/auth/phone-login-form";
import WhatsAppLoginForm from "@/components/auth/whatsapp-login-form";
import AuthLayout from "@/components/layouts/auth-layout";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import logoPath from "@assets/AR-Only.png";
import { VersionDisplay } from "@/components/version-display";

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

  const handleLoginSuccess = async (userId: number, userRole: string) => {
    try {
      console.log("[LOGIN PAGE] Login success handler called with userId:", userId, "userRole:", userRole);
      
      // Call the login function and wait for it to complete
      await login(userId.toString(), userRole);
      
      // Add a longer delay to ensure the auth state is fully updated before redirect
      console.log("[LOGIN PAGE] Login successful, redirecting to dashboard...");
      
      setTimeout(() => {
        if (userRole === "admin") {
          console.log("[LOGIN PAGE] Redirecting to admin dashboard");
          setLocation("/admin/dashboard");
        } else {
          console.log("[LOGIN PAGE] Redirecting to installer dashboard");
          setLocation("/installer/dashboard");
        }
      }, 1500); // Increased timeout to ensure session is established
    } catch (error) {
      console.error("[LOGIN PAGE] Error in login success handler:", error);
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
    <div className="min-h-screen flex flex-col md:flex-row rtl">
      {/* Login Form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-10 bg-white">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img 
              src={logoPath}
              alt="برنامج مكافات بريق" 
              className="h-16 object-contain"
            />
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-center text-gray-800">
            تسجيل الدخول
          </h1>
          <p className="text-center text-gray-500 mb-8">
            اختر طريقة تسجيل الدخول المفضلة
          </p>
          
          <WhatsAppLoginForm onSuccess={handleLoginSuccess} />
        </div>
      </div>

      {/* Hero Section */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-blue-500 flex flex-col items-center justify-center p-6 md:p-10 text-white relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 z-0">
          <svg className="opacity-10" width="100%" height="100%">
            <pattern id="pattern-circles" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">
              <circle id="pattern-circle" cx="25" cy="25" r="12" fill="white"></circle>
            </pattern>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-circles)"></rect>
          </svg>
        </div>
        
        <div className="relative z-10 max-w-md">
          <div className="mb-8 flex justify-center">
            <img 
              src={logoPath} 
              alt="برنامج مكافات بريق" 
              className="h-20 md:h-24 object-contain"
            />
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl shadow-xl border-0">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center">
              برنامج مكافات بريق
            </h1>
            <p className="text-lg text-center mb-6">
              نظام المكافآت الخاص بفنيي التركيب
            </p>
            
            <div className="space-y-4">
              <div className="flex rtl items-center bg-white/5 p-3 rounded-lg">
                <div className="flex-shrink-0 ml-3">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/20 text-white font-semibold">١</span>
                </div>
                <p>تسجيل عمليات التركيب وكسب النقاط</p>
              </div>
              
              <div className="flex rtl items-center bg-white/5 p-3 rounded-lg">
                <div className="flex-shrink-0 ml-3">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/20 text-white font-semibold">٢</span>
                </div>
                <p>متابعة نقاطك ومستوى الإنجاز</p>
              </div>
              
              <div className="flex rtl items-center bg-white/5 p-3 rounded-lg">
                <div className="flex-shrink-0 ml-3">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/20 text-white font-semibold">٣</span>
                </div>
                <p>جمع الشارات ومتابعة تقدمك</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Version display at the bottom of the page - now with responsive behavior */}
      <div className="fixed bottom-2 left-0 right-0 text-center">
        <VersionDisplay 
          variant="responsive" 
          className="font-medium hover:text-primary/80 transition-colors px-2 py-1 rounded-md" 
        />
      </div>
    </div>
  );
}