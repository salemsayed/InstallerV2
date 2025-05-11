import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function ReplitLoginButton() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleLogin = () => {
    setIsLoading(true);
    // Redirect to Replit Auth
    window.location.href = "/api/login";
  };
  
  return (
    <Button 
      onClick={handleLogin} 
      className="w-full mt-4 bg-[#0d101e] hover:bg-[#1d2235] text-white" 
      disabled={isLoading}
    >
      {isLoading ? "جارٍ تحميل صفحة تسجيل الدخول..." : "تسجيل الدخول باستخدام Replit"}
    </Button>
  );
}