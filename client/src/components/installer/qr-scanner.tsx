import { useState, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, X, Camera, Scan } from "lucide-react";
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
          fps: 15, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Make QR box responsive - use 70% of the smaller dimension
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.7);
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
      setError("Failed to start camera. Please grant camera permission. (ERROR_CODE: CAMERA_PERMISSION)");
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
      setError("Invalid QR code format. Please scan a valid warranty code. (ERROR_CODE: INVALID_FORMAT)\n\nExpected format: https://warranty.bareeq.lighting/p/[UUID]");
      setIsValidating(false);
      return;
    }

    const uuid = match[1];
    console.log("Extracted UUID:", uuid);

    // Step 2: UUID validation
    if (!isValidUUIDv4(uuid)) {
      setError("Invalid product code UUID. Please scan a valid warranty code. (ERROR_CODE: INVALID_UUID)\n\nDetected UUID: " + uuid);
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
        title: "Product Verified Successfully ✓",
        description: `Product: ${result.productName || "Unknown"}\nPoints awarded: ${result.pointsAwarded || 10}`,
        variant: "default",
      });
      
      if (onScanSuccess) {
        onScanSuccess(result.productName);
      }
      
    } catch (err: any) {
      console.error("Validation error:", err);
      setError(`Error validating QR code. Please try again. (ERROR_CODE: VALIDATION_ERROR)\n\nDetails: ${err.message || "Unknown error"}`);
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
        className="fixed bottom-14 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full shadow-xl bg-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/50 z-10 flex flex-col items-center justify-center border-4 border-white"
        aria-label="فتح الماسح الضوئي"
      >
        <QrCode className="h-8 w-8" />
        <span className="text-[12px] mt-1 font-bold">مسح</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-full max-h-[100dvh] h-[100dvh] w-full p-0 rounded-none border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>مسح رمز QR للمنتج</DialogTitle>
          </DialogHeader>
          
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/70 to-transparent p-4 flex justify-between items-center">
            <h2 className="text-white font-bold text-xl">مسح رمز QR للمنتج</h2>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* QR Scanner Area */}
          <div className="relative h-full w-full bg-black flex items-center justify-center">
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
                      variant="outline" 
                      className="flex-1 border-white/20 text-white hover:bg-white/10 hover:text-white" 
                      onClick={() => setError(null)}
                    >
                      المحاولة مرة أخرى
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => handleOpenChange(false)}
                    >
                      العودة
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Scanner */}
                <div
                  id="qr-reader"
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
                    <div className="absolute bottom-24 left-0 right-0 flex justify-center">
                      <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                        وجه الكاميرا نحو رمز QR الخاص بالمنتج
                      </div>
                    </div>
                  </div>
                )}

                {/* Scanner controls */}
                <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent ${isScanning ? '' : 'bg-black/90 bottom-0 top-0 flex items-center justify-center'}`}>
                  {!isScanning ? (
                    <div className="flex flex-col items-center gap-6 max-w-md mx-auto p-4">
                      <Scan className="h-20 w-20 text-primary mb-4" />
                      <h3 className="text-white text-xl font-bold">مسح رمز QR للمنتج</h3>
                      <p className="text-white/70 text-center mb-6">قم بمسح رمز QR الموجود على المنتج للتحقق من أصالته وإضافة النقاط لحسابك</p>
                      <Button 
                        onClick={startScanner} 
                        className="w-full gap-2"
                        size="lg"
                      >
                        <Camera className="h-5 w-5" />
                        فتح الكاميرا
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={stopScanner} 
                      variant="default" 
                      className="w-full bg-primary text-white border-none hover:bg-primary/90"
                    >
                      <X className="h-4 w-4 mr-2" />
                      إغلاق الكاميرا
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}