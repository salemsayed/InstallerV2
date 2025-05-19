import { useState, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, X, Camera, Scan } from "lucide-react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useAuth } from "@/hooks/auth-provider";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

interface AdvancedQrScannerProps {
  onScanSuccess?: (productName: string) => void;
}

export default function AdvancedQrScanner({ onScanSuccess }: AdvancedQrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

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

    const qrCodeId = "advanced-qr-reader";
    const qrContainer = document.getElementById(qrCodeId);
    
    if (!qrContainer) {
      setError("عنصر الماسح الضوئي غير موجود (رمز الخطأ: ELEMENT_NOT_FOUND)");
      setIsScanning(false);
      return;
    }

    html5QrCode = new Html5Qrcode(qrCodeId);

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Make QR box responsive - use 80% of the smaller dimension for advanced scanner
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.8);
            return {width: boxSize, height: boxSize};
          },
          aspectRatio: window.innerHeight > window.innerWidth ? window.innerHeight / window.innerWidth : 1.0,
        },
        handleScanSuccess,
        (errorMessage) => {
          // Don't show QR scanning errors to users, as they are not useful
          console.log("QR scan error:", errorMessage);
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError("فشل بدء تشغيل الكاميرا. يرجى منح إذن الكاميرا. (رمز الخطأ: CAMERA_PERMISSION)");
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
    // Support two formats: warranty.bareeq.lighting and w.bareeq.lighting
    const warrantyUrlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    const shortUrlRegex = /^https:\/\/w\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    
    const warrantyMatch = url.match(warrantyUrlRegex);
    const shortMatch = url.match(shortUrlRegex);
    
    if (!warrantyMatch && !shortMatch) {
      setError("صيغة رمز QR غير صالحة. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_FORMAT)\n\nالصيغة المتوقعة: https://warranty.bareeq.lighting/p/[UUID] أو https://w.bareeq.lighting/p/[UUID]");
      setIsValidating(false);
      return;
    }

    const uuid = warrantyMatch ? warrantyMatch[1] : shortMatch![1];
    console.log("Extracted UUID:", uuid);

    // Step 2: UUID validation
    if (!isValidUUIDv4(uuid)) {
      setError("رمز المنتج UUID غير صالح. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_UUID)\n\nالرمز المكتشف: " + uuid);
      setIsValidating(false);
      return;
    }

    try {
      // Step 3: Send to server for validation and processing
      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND)");
        setIsValidating(false);
        return;
      }
      
      console.log("Sending QR scan request with:", {
        endpoint: `/api/scan-qr?userId=${user.id}`,
        user: user,
        uuid: uuid
      });
      
      const scanResult = await apiRequest(
        "POST", 
        `/api/scan-qr?userId=${user.id}`, 
        {
          uuid
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
      
      // Log success and product name
      console.log("Scanned product:", result.productName);
      
      // Call refreshUser to update user data directly in the auth context
      refreshUser()
        .then(() => console.log("User refreshed after successful scan"))
        .catch(err => console.error("Error refreshing user after scan:", err));
      
      // Aggressively invalidate and immediately refetch all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/badges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      
      // Force instant refetch of all invalidated queries
      queryClient.refetchQueries({ 
        queryKey: [`/api/transactions?userId=${user?.id}`],
        exact: true 
      });
      queryClient.refetchQueries({ 
        queryKey: ['/api/badges', user?.id],
        exact: true 
      });
      queryClient.refetchQueries({ 
        queryKey: ['/api/users/me'],
        exact: true 
      });
      
      // Show success toast
      toast({
        title: "تم التحقق من المنتج بنجاح ✓",
        description: `المنتج: ${result.productName || "غير معروف"}\nالنقاط المكتسبة: ${result.pointsAwarded || 10}`,
        variant: "default",
      });
      
      if (onScanSuccess) {
        onScanSuccess(result.productName);
      }
      
      // Reset scanner after successful scan
      setIsScanning(false);
      setError(null);
      
    } catch (err: any) {
      console.error("Validation error:", err);
      setError(`خطأ في التحقق من رمز QR. يرجى المحاولة مرة أخرى. (رمز الخطأ: VALIDATION_ERROR)\n\nتفاصيل: ${err.message || "خطأ غير معروف"}`);
      setIsValidating(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-white flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">المسح المتقدم</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          المسح المتقدم يستخدم مفتاح ترخيص Scandit للتعرف على المنتجات بشكل أفضل ودعم مسح الباركود
        </p>
      </div>
      
      {/* QR Scanner Area */}
      <div className="relative w-full h-96 max-w-lg bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
        {isValidating ? (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-40">
            <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-center text-white text-lg font-medium">جارٍ التحقق من الكود...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-40 p-6">
            <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm max-w-md w-full">
              <div className="text-destructive font-bold text-lg mb-2">حدث خطأ</div>
              <div className="text-white/90 whitespace-pre-wrap mb-4 max-h-[50vh] overflow-y-auto">{error}</div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="default" 
                  className="flex-1 bg-primary text-white hover:bg-primary/90" 
                  onClick={() => {
                    setError(null);
                    startScanner();
                  }}
                >
                  <span className="flex items-center gap-1">
                    <Camera className="h-4 w-4" />
                    المحاولة مرة أخرى
                  </span>
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10"
                  onClick={() => {
                    setError(null);
                    setIsScanning(false);
                  }}
                >
                  <span className="flex items-center gap-1">
                    <X className="h-4 w-4" />
                    العودة
                  </span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Scanner */}
            <div
              id="advanced-qr-reader"
              className={`w-full h-full ${!isScanning ? 'hidden' : ''}`}
            ></div>

            {/* Scanner overlay - corners to guide scanning */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-[80vmin] h-[80vmin] max-w-sm max-h-sm">
                    {/* Scan animation */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-scanline"></div>
                    
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary"></div>
                    <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary"></div>
                  </div>
                </div>
                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                  <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                    وجه الكاميرا نحو رمز QR الخاص بالمنتج
                  </div>
                </div>
              </div>
            )}

            {/* Scanner placeholder when not scanning */}
            {!isScanning && (
              <div className="flex flex-col items-center justify-center h-full w-full">
                <Scan className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-500 text-center mb-4">
                  قم بمسح رمز QR الموجود على المنتج للتحقق من أصالته وإضافة النقاط لحسابك
                </p>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Scanner controls */}
      <div className="mt-6 w-full max-w-lg">
        {!isScanning ? (
          <Button 
            onClick={startScanner} 
            className="w-full gap-2"
            size="lg"
          >
            <Camera className="h-5 w-5" />
            فتح الكاميرا
          </Button>
        ) : (
          <Button 
            onClick={stopScanner} 
            variant="default" 
            className="w-full bg-primary text-white border-none hover:bg-primary/90"
            size="lg"
          >
            <X className="h-4 w-4 mr-2" />
            إغلاق الكاميرا
          </Button>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        ترخيص Scandit: مفعّل 
        <span className="text-green-500 font-bold mr-1">✓</span>
      </div>
    </div>
  );
}