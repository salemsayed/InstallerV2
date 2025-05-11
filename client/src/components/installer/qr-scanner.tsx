import { useState, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode } from "lucide-react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useAuth } from "@/hooks/auth-provider";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

interface QrScannerProps {
  onScanSuccess?: (productName: string) => void;
}

export default function QrScanner({ onScanSuccess }: QrScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  let html5QrCode: Html5Qrcode | null = null;

  useEffect(() => {
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(error => console.error("Error stopping scanner:", error));
      }
    };
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);

    const qrCodeId = "qr-reader";
    const qrContainer = document.getElementById(qrCodeId);
    
    if (!qrContainer) {
      setError("QR scanner element not found (ERROR_CODE: ELEMENT_NOT_FOUND)");
      setIsScanning(false);
      return;
    }

    html5QrCode = new Html5Qrcode(qrCodeId);

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        (errorMessage) => {
          // Don't show QR scanning errors to users, as they are not useful
          console.log("QR scan error:", errorMessage);
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError("فشل في تشغيل الكاميرا. الرجاء منح الإذن للوصول إلى الكاميرا.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCode && html5QrCode.isScanning) {
      await html5QrCode.stop();
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    console.log("QR code detected:", decodedText);
    await stopScanner();
    await validateQrCode(decodedText);
  };

  const validateQrCode = async (url: string) => {
    setIsValidating(true);
    setError(null);

    // Step 1: URL shape validation
    const urlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    const match = url.match(urlRegex);
    
    if (!match) {
      setError("الرمز غير صالح. الرجاء التأكد من مسح رمز الضمان الصحيح.");
      setIsValidating(false);
      return;
    }

    const uuid = match[1];
    console.log("Extracted UUID:", uuid);

    // Step 2: UUID validation
    if (!isValidUUIDv4(uuid)) {
      setError("معرف الكود غير صالح.");
      setIsValidating(false);
      return;
    }

    try {
      // Step 3: Send to server for validation and processing
      const scanResult = await apiRequest(
        "POST", 
        "/api/scan-qr", 
        {
          uuid,
          userId: user?.id
        }
      );
      
      const result = await scanResult.json();
      
      if (!result.success) {
        const errorDetails = result.details ? JSON.stringify(result.details, null, 2) : '';
        const errorCode = result.error_code ? ` (${result.error_code})` : '';
        
        setError(`${result.message}${errorCode}\n${errorDetails}`);
        setIsValidating(false);
        
        console.error('QR Validation Error:', {
          message: result.message,
          code: result.error_code,
          details: result.details
        });
        
        if (result.details?.duplicate) {
          // If it's a duplicate, allow user to scan again
          startScanner();
        }
        
        return;
      }
      
      // Success path
      setIsValidating(false);
      setIsOpen(false);
      
      toast({
        title: "تم التحقق بنجاح ✓",
        description: `المنتج: ${result.productName}`,
        variant: "default",
      });
      
      if (onScanSuccess) {
        onScanSuccess(result.productName);
      }
      
    } catch (err) {
      console.error("Validation error:", err);
      setError("حدث خطأ أثناء التحقق من الكود. الرجاء المحاولة مرة أخرى.");
      setIsValidating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    
    if (!open && html5QrCode && html5QrCode.isScanning) {
      stopScanner();
    }
    
    // Reset states when dialog is closed
    if (!open) {
      setError(null);
      setIsScanning(false);
      setIsValidating(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary/50"
        aria-label="فتح الماسح الضوئي"
      >
        <QrCode className="h-6 w-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-xl">
              مسح رمز الاستجابة السريعة
            </DialogTitle>
          </DialogHeader>

          <div className="my-4">
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded border border-destructive text-sm">
                <div className="whitespace-pre-wrap font-mono text-xs">{error}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 w-full" 
                  onClick={() => setError(null)}
                >
                  Dismiss Error
                </Button>
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              {isValidating ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-center text-gray-500">جارٍ التحقق من الكود...</p>
                </div>
              ) : (
                <>
                  <div
                    id="qr-reader"
                    className={`w-full overflow-hidden rounded-lg border ${
                      isScanning ? "h-64" : "h-0"
                    }`}
                  ></div>

                  {!isScanning ? (
                    <Button 
                      onClick={startScanner} 
                      className="w-full"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      فتح الكاميرا
                    </Button>
                  ) : (
                    <Button 
                      onClick={stopScanner} 
                      variant="outline" 
                      className="w-full"
                    >
                      إغلاق الكاميرا
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}