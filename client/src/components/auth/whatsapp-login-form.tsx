import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import PhoneLoginForm from "./phone-login-form";

interface WhatsAppLoginFormProps {
  onSuccess: (userId: number, userRole: string) => void;
}

export default function WhatsAppLoginForm({ onSuccess }: WhatsAppLoginFormProps) {
  const [wasageData, setWasageData] = useState<{
    qrImageUrl: string;
    clickableUrl: string;
    otp: string;
    reference: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"sms" | "whatsapp">("sms");
  const { toast } = useToast();

  // Function to initiate WhatsApp login by calling the API
  const initiateWhatsAppLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/wasage/otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("Wasage response:", data);

      if (data.success) {
        setWasageData({
          qrImageUrl: data.qrImageUrl,
          clickableUrl: data.clickableUrl,
          otp: data.otp,
          reference: data.reference,
        });
      } else {
        toast({
          title: "خطأ",
          description: data.message || "حدث خطأ أثناء محاولة تسجيل الدخول عبر واتساب",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error initiating WhatsApp login:", error);
      toast({
        title: "خطأ",
        description: "فشل الاتصال بالخادم، يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetWhatsAppLogin = () => {
    setWasageData(null);
    // Trigger the API call again after resetting
    setTimeout(() => {
      initiateWhatsAppLogin();
    }, 100);
  };

  // State to track authentication errors
  const [authError, setAuthError] = useState<string | null>(null);

  // Function to check authentication status
  const checkAuthStatus = async (reference: string) => {
    try {
      console.log("[WHATSAPP AUTH] Checking auth status for reference:", reference);
      const response = await fetch(`/api/auth/wasage/status?reference=${reference}`, {
        credentials: "include", // Critical to include cookies for authenticated requests
      });
      const data = await response.json();
      
      console.log("[WHATSAPP AUTH] Status response:", data);
      
      if (data.success && data.authenticated) {
        console.log("[WHATSAPP AUTH] Authentication successful, userId:", data.userId);
        // Add a delay before calling onSuccess to ensure server session is fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        // If authenticated, call the onSuccess handler with the user info
        onSuccess(data.userId, data.userRole);
        return true;
      } 
      // Check if there was an authentication error (e.g., phone number not found)
      else if (data.error) {
        console.error("[WHATSAPP AUTH] Error in status check:", data.message);
        // Set error message to display in UI instead of automatically resetting
        setAuthError(data.message || "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك.");
        // Show a toast notification
        toast({
          title: "خطأ في تسجيل الدخول",
          description: data.message || "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك.",
          variant: "destructive",
        });
        // Return true to stop polling
        return true;
      }
      return false;
    } catch (error) {
      console.error("[WHATSAPP AUTH] Error checking auth status:", error);
      return false;
    }
  };
  
  // Effect to poll for authentication status when QR code is displayed
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let authFailureTimeout: NodeJS.Timeout | null = null;
    
    if (wasageData) {
      // Start polling for auth status every 3 seconds
      pollInterval = setInterval(async () => {
        const authenticated = await checkAuthStatus(wasageData.reference);
        if (authenticated) {
          // Clear interval when authenticated or error is received
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 3000);
      
      // Set a timeout to automatically check for phone number not found errors
      // This is a fallback in case the polling doesn't catch it
      authFailureTimeout = setTimeout(async () => {
        try {
          const response = await fetch(`/api/auth/wasage/status?reference=${wasageData.reference}`);
          const data = await response.json();
          
          // If there's an error flag in the response, show it and display error UI
          if (data.error) {
            toast({
              title: "خطأ في تسجيل الدخول",
              description: data.message || "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك.",
              variant: "destructive",
            });
            // Set error message in state to display in UI instead of resetting form
            setAuthError(data.message || "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك.");
          }
        } catch (error) {
          console.error("Error checking auth failure:", error);
        }
      }, 8000); // Check after 8 seconds - by then we should have received callback if the phone number is invalid
    }
    
    // Cleanup polling and timeout on unmount or when wasageData changes
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (authFailureTimeout) clearTimeout(authFailureTimeout);
    };
  }, [wasageData]);

  // Effect to trigger WhatsApp login when tab is changed to whatsapp
  useEffect(() => {
    if (loginMethod === "whatsapp" && !wasageData && !isLoading) {
      initiateWhatsAppLogin();
    }
  }, [loginMethod]);

  return (
    <Tabs
      defaultValue="sms"
      onValueChange={(value) => setLoginMethod(value as "sms" | "whatsapp")}
      className="w-full"
    >
      <TabsList className="grid grid-cols-2 mb-6">
        <TabsTrigger value="sms">رمز التحقق SMS</TabsTrigger>
        <TabsTrigger value="whatsapp">تسجيل الدخول عبر واتساب</TabsTrigger>
      </TabsList>

      <TabsContent value="sms">
        <PhoneLoginForm onSuccess={onSuccess} />
      </TabsContent>

      <TabsContent value="whatsapp">
        {!wasageData && !authError ? (
          <div className="flex flex-col items-center space-y-4">
            <p className="text-center text-gray-600 mb-4">
              جاري تحضير تسجيل الدخول عبر واتساب...
            </p>
            <div className="w-full flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        ) : authError ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full">
              <div className="flex flex-col items-center gap-3 mb-2">
                <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-center">
                  <h4 className="font-medium text-red-700 text-lg mb-1">خطأ في تسجيل الدخول</h4>
                  <p className="text-sm text-gray-700 mb-4">{authError}</p>
                </div>
              </div>
              
              <Button 
                onClick={() => {
                  setAuthError(null);
                  setWasageData(null);
                  // Wait a moment before initiating a new login attempt
                  setTimeout(() => {
                    initiateWhatsAppLogin();
                  }, 500);
                }}
                className="w-full"
              >
                إعادة المحاولة
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="border border-gray-200 rounded-lg p-2 bg-white">
              <img
                src={wasageData.qrImageUrl}
                alt="WhatsApp QR Code"
                className="w-64 h-64 object-contain"
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">
                امسح رمز QR باستخدام كاميرا واتساب
              </p>
              <p className="text-sm text-gray-600 mb-4">أو</p>
            </div>
            <a
              href={wasageData.clickableUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white h-11 px-8 w-full"
            >
              <svg
                className="h-5 w-5 ml-2"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              فتح واتساب لتسجيل الدخول
            </a>
            <Button
              variant="outline"
              onClick={resetWhatsAppLogin}
              className="w-full mt-2"
            >
              إلغاء وإعادة المحاولة
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}