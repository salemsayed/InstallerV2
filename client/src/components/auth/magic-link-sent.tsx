import { Button } from "@/components/ui/button";

interface MagicLinkSentProps {
  onReset: () => void;
  email: string;
}

export default function MagicLinkSent({ onReset, email }: MagicLinkSentProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="text-center">
        <span className="material-icons text-5xl text-primary mb-4">mark_email_read</span>
        <h2 className="text-xl font-bold mb-2">تم إرسال رابط تسجيل الدخول</h2>
        <p className="text-neutral-600 mb-6">
          تم إرسال رابط تسجيل الدخول إلى {email}. يرجى التحقق من بريدك الإلكتروني للمتابعة.
        </p>
        <Button 
          variant="link" 
          onClick={onReset}
          className="text-primary font-medium"
        >
          العودة
        </Button>
      </div>
    </div>
  );
}
