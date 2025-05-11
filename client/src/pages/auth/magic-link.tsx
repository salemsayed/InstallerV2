import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AuthLayout from "@/components/layouts/auth-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/auth-provider";
import { Button } from "@/components/ui/button";

export default function MagicLink() {
  const [, setLocation] = useLocation();
  const { verifyToken, isLoading, error } = useAuth();
  const [status, setStatus] = useState<"loading" | "error" | "invalid" | "success">("loading");
  const [statusMessage, setStatusMessage] = useState("جارٍ التحقق من الرابط...");
  
  useEffect(() => {
    const verifyMagicLink = async () => {
      // Get token and email from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const email = params.get("email");
      
      if (!token || !email) {
        setStatus("invalid");
        setStatusMessage("رابط غير صالح. يرجى التحقق من الرابط أو طلب رابط جديد.");
        return;
      }
      
      try {
        const success = await verifyToken(token, email);
        
        if (success) {
          setStatus("success");
          setStatusMessage("تم تسجيل الدخول بنجاح! جارٍ تحويلك...");
          // Redirect is handled by the auth context
        } else {
          setStatus("error");
          setStatusMessage("فشل التحقق من الرابط. يرجى طلب رابط جديد.");
        }
      } catch (err) {
        setStatus("error");
        setStatusMessage("حدث خطأ أثناء التحقق من الرابط. يرجى المحاولة مرة أخرى.");
      }
    };
    
    verifyMagicLink();
  }, [verifyToken, setLocation]);

  return (
    <AuthLayout>
      <Card className="bg-white rounded-2xl shadow-lg border-0">
        <CardContent className="p-8">
          <div className="text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                <h2 className="text-xl font-bold mb-2">جارٍ تسجيل الدخول</h2>
                <p className="text-neutral-600 mb-6">يرجى الانتظار بينما نتحقق من رابط تسجيل الدخول الخاص بك</p>
              </>
            )}
            
            {status === "success" && (
              <>
                <span className="material-icons text-5xl text-green-500 mb-4">check_circle</span>
                <h2 className="text-xl font-bold mb-2">تم تسجيل الدخول بنجاح</h2>
                <p className="text-neutral-600 mb-6">جارٍ تحويلك إلى لوحة التحكم الخاصة بك</p>
              </>
            )}
            
            {(status === "error" || status === "invalid") && (
              <>
                <span className="material-icons text-5xl text-red-500 mb-4">error</span>
                <h2 className="text-xl font-bold mb-2">فشل تسجيل الدخول</h2>
                <p className="text-neutral-600 mb-6">{statusMessage || error}</p>
                <Button 
                  onClick={() => setLocation("/")}
                  className="mx-auto"
                >
                  العودة إلى صفحة تسجيل الدخول
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
