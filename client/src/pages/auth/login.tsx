import { useState } from "react";
import AuthLayout from "@/components/layouts/auth-layout";
import LoginForm from "@/components/auth/login-form";
import MagicLinkSent from "@/components/auth/magic-link-sent";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  const [showMagicLinkSent, setShowMagicLinkSent] = useState(false);
  const [email, setEmail] = useState("");
  
  const handleLoginSuccess = (token: string, email: string) => {
    setEmail(email);
    setShowMagicLinkSent(true);
    
    // Optional: Simulate email by opening the magic link page directly with the token
    // This is for development/demo purposes only
    // In production, the user would get an actual email with the link
    setTimeout(() => {
      window.location.href = `/auth/magic-link?token=${token}&email=${encodeURIComponent(email)}`;
    }, 3000);
  };
  
  const handleReset = () => {
    setShowMagicLinkSent(false);
    setEmail("");
  };
  
  return (
    <AuthLayout>
      {showMagicLinkSent ? (
        <MagicLinkSent onReset={handleReset} email={email} />
      ) : (
        <Card className="bg-white rounded-2xl shadow-lg border-0">
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-center mb-6">مرحباً بك في برنامج مكافآت بريق</h1>
            <p className="text-neutral-600 text-center mb-8">برنامج المكافآت الخاص بالفنيين المعتمدين</p>
            
            <LoginForm onSuccess={handleLoginSuccess} />
            
            <div className="mt-6 text-center text-neutral-500 text-sm">
              <p>هذا البرنامج متاح فقط للفنيين المعتمدين من بريق</p>
            </div>
          </CardContent>
        </Card>
      )}
    </AuthLayout>
  );
}
