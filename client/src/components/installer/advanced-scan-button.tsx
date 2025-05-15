import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

/**
 * Advanced scan button to redirect to the Scandit-powered scanner page
 * Used as a replacement for the regular QR scanner in the middle of the bottom tab bar
 */
export default function AdvancedScanButton() {
  const [location, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/installer/advanced-scan");
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-14 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full shadow-xl bg-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/50 z-10 flex flex-col items-center justify-center border-4 border-white"
      aria-label="فتح الماسح المتقدم"
    >
      <QrCode className="h-8 w-8" />
      <span className="text-[12px] mt-1 font-bold">مسح</span>
    </Button>
  );
}