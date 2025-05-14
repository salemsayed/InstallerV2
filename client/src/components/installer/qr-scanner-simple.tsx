import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, X, Camera as CameraIcon } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  // This is a fallback implementation while we resolve the Scandit integration
  // Use standard HTML5 camera API instead of Scandit

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setError(null);
      setQrValue("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrValue) return;

    console.log("[QR VALIDATION] Manual URL submitted:", qrValue);
    await validateQrCode(qrValue);
  };

  const validateQrCode = async (url: string) => {
    console.log("[QR VALIDATION] Starting QR validation for URL:", url);
    setIsValidating(true);
    setError(null);

    // Step 1: URL shape validation
    // Support two formats: warranty.bareeq.lighting and w.bareeq.lighting
    const warrantyUrlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    const shortUrlRegex = /^https:\/\/w\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    
    console.log("[QR VALIDATION] Checking URL against regex patterns");
    const warrantyMatch = url.match(warrantyUrlRegex);
    const shortMatch = url.match(shortUrlRegex);
    
    if (!warrantyMatch && !shortMatch) {
      console.error("[QR VALIDATION] URL failed regex validation:", url);
      console.log("[QR VALIDATION] warrantyMatch:", warrantyMatch);
      console.log("[QR VALIDATION] shortMatch:", shortMatch);
      setError("صيغة رمز QR غير صالحة. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_FORMAT)\n\nالصيغة المتوقعة: https://warranty.bareeq.lighting/p/[UUID] أو https://w.bareeq.lighting/p/[UUID]");
      setIsValidating(false);
      return;
    }

    const uuid = warrantyMatch ? warrantyMatch[1] : shortMatch![1];
    console.log("[QR VALIDATION] Extracted UUID:", uuid);

    // Step 2: UUID validation
    console.log("[QR VALIDATION] Validating UUID format:", uuid);
    if (!isValidUUIDv4(uuid)) {
      console.error("[QR VALIDATION] Invalid UUID format:", uuid);
      setError("رمز المنتج UUID غير صالح. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_UUID)\n\nالرمز المكتشف: " + uuid);
      setIsValidating(false);
      return;
    }

    try {
      // Step 3: Send to server for validation and processing
      console.log("[QR VALIDATION] Sending UUID to server for validation:", uuid);
      console.log("[QR VALIDATION] User ID:", user?.id);
      
      const scanResult = await apiRequest(
        "POST", 
        "/api/scan-qr", 
        {
          uuid,
          userId: user?.id
        }
      );
      
      console.log("[QR VALIDATION] Server response status:", scanResult.status);
      const result = await scanResult.json();
      console.log("[QR VALIDATION] Server response data:", result);
      
      if (!result.success) {
        console.log("[QR VALIDATION] Server validation failed");
        const errorDetails = result.details ? JSON.stringify(result.details, null, 2) : '';
        const errorCode = result.error_code ? ` (${result.error_code})` : '';
        
        setError(`${result.message}${errorCode}\n${errorDetails}`);
        setIsValidating(false);
        
        console.error('[QR VALIDATION] Error details:', {
          message: result.message,
          code: result.error_code,
          details: result.details
        });
        
        return;
      }
      
      // Success path
      console.log("[QR VALIDATION] Server validation successful!");
      setIsValidating(false);
      setIsOpen(false);
      
      // Log success and product name
      console.log("[QR VALIDATION] Scanned product:", result.productName);
      console.log("[QR VALIDATION] Points awarded:", result.pointsAwarded);
      
      // Call refreshUser to update user data directly in the auth context
      console.log("[QR VALIDATION] Refreshing user data...");
      refreshUser()
        .then(() => console.log("[QR VALIDATION] User data refreshed successfully"))
        .catch(err => console.error("[QR VALIDATION] Error refreshing user data:", err));
      
      // Aggressively invalidate and immediately refetch all relevant queries
      console.log("[QR VALIDATION] Invalidating queries to refresh data");
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/badges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      
      // Force instant refetch of all invalidated queries
      console.log("[QR VALIDATION] Forcing immediate refetch of transactions");
      queryClient.refetchQueries({ 
        queryKey: [`/api/transactions?userId=${user?.id}`],
        exact: true 
      });
      console.log("[QR VALIDATION] Forcing immediate refetch of badges");
      queryClient.refetchQueries({ 
        queryKey: ['/api/badges', user?.id],
        exact: true 
      });
      console.log("[QR VALIDATION] Forcing immediate refetch of user data");
      queryClient.refetchQueries({ 
        queryKey: ['/api/users/me'],
        exact: true 
      });
      
      // Show success toast
      console.log("[QR VALIDATION] Showing success toast");
      toast({
        title: "تم التحقق من المنتج بنجاح ✓",
        description: `المنتج: ${result.productName || "غير معروف"}\nالنقاط المكتسبة: ${result.pointsAwarded || 10}`,
        variant: "default",
      });
      
      if (onScanSuccess) {
        console.log("[QR VALIDATION] Calling onScanSuccess callback");
        onScanSuccess(result.productName);
      }
      
      console.log("[QR VALIDATION] QR validation process completed successfully");
      
    } catch (err: any) {
      console.error("[QR VALIDATION] Error during validation:", err);
      if (err && typeof err === 'object') {
        console.error("[QR VALIDATION] Error properties:", Object.keys(err));
        console.error("[QR VALIDATION] Error message:", err.message);
        console.error("[QR VALIDATION] Error stack:", err.stack);
      } else {
        console.error("[QR VALIDATION] Error is not an object:", typeof err);
      }
      
      setError(`خطأ في التحقق من رمز QR. يرجى المحاولة مرة أخرى. (رمز الخطأ: VALIDATION_ERROR)\n\nتفاصيل: ${err.message || "خطأ غير معروف"}`);
      setIsValidating(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <QrCode className="h-4 w-4 ml-2" />
        إدخال رمز المنتج
      </Button>
      
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md h-auto p-6 bg-white rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              إدخال رمز المنتج
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {isValidating ? (
              <div className="flex flex-col items-center justify-center p-6">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-center text-lg font-medium">جارٍ التحقق من رمز المنتج...</p>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 rounded-md p-4">
                <h3 className="text-destructive font-bold text-lg mb-2">حدث خطأ</h3>
                <p className="text-gray-800 whitespace-pre-wrap mb-4">{error}</p>
                <Button 
                  variant="default" 
                  className="w-full" 
                  onClick={() => setError(null)}
                >
                  حاول مرة أخرى
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium block">
                    رابط رمز الضمان (QR)
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://warranty.bareeq.lighting/p/..."
                    value={qrValue}
                    onChange={(e) => setQrValue(e.target.value)}
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500">
                    قم بإدخال رابط رمز الضمان QR كاملاً. مثال: 
                    https://warranty.bareeq.lighting/p/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                  </p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full gap-2"
                  disabled={!qrValue.trim()}
                >
                  <CameraIcon className="h-4 w-4" />
                  التحقق من الرمز
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}