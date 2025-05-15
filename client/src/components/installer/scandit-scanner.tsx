import React, { useState, useEffect, useRef } from "react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2, QrCode, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

interface ScanditScannerProps {
  onScanSuccess?: (productName: string) => void;
}

export default function ScanditScanner({ onScanSuccess }: ScanditScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<'initialized' | 'failed' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  
  // Reference to context and capture for later use
  const contextRef = useRef<any>(null);
  const captureRef = useRef<any>(null);
  
  // Function to validate QR code
  const validateQrCode = async (url: string) => {
    setIsValidating(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: URL shape validation
      // Support two formats: warranty.bareeq.lighting and w.bareeq.lighting
      const warrantyUrlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
      const shortUrlRegex = /^https:\/\/w\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
      
      const warrantyMatch = url.match(warrantyUrlRegex);
      const shortMatch = url.match(shortUrlRegex);
      
      if (!warrantyMatch && !shortMatch) {
        setError("صيغة رمز QR غير صالحة. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_FORMAT)\n\nالصيغة المتوقعة: https://warranty.bareeq.lighting/p/[UUID] أو https://w.bareeq.lighting/p/[UUID]");
        setIsValidating(false);
        resetScannerAfterDelay();
        return;
      }

      const uuid = warrantyMatch ? warrantyMatch[1] : shortMatch![1];
      console.log("Extracted UUID:", uuid);

      // Step 2: UUID validation
      if (!isValidUUIDv4(uuid)) {
        setError("رمز المنتج UUID غير صالح. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_UUID)\n\nالرمز المكتشف: " + uuid);
        setIsValidating(false);
        resetScannerAfterDelay();
        return;
      }

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
          resetScannerAfterDelay();
        } else {
          resetScannerAfterDelay(3000);
        }
        
        return;
      }
      
      // Success path
      setIsValidating(false);
      setResult(`تم التحقق من المنتج: ${result.productName}`);
      
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
      
      // Close dialog after successful scan
      setTimeout(() => {
        setIsOpen(false);
        if (onScanSuccess) {
          onScanSuccess(result.productName);
        }
      }, 1500);
      
    } catch (err: any) {
      console.error("Validation error:", err);
      setError(`خطأ في التحقق من رمز QR. يرجى المحاولة مرة أخرى. (رمز الخطأ: VALIDATION_ERROR)\n\nتفاصيل: ${err.message || "خطأ غير معروف"}`);
      setIsValidating(false);
      resetScannerAfterDelay(3000);
    }
  };

  const resetScannerAfterDelay = (delay = 1500) => {
    setTimeout(() => {
      try {
        if (captureRef.current) {
          console.log("Re-enabling scanner after validation");
          captureRef.current.setEnabled(true).catch(console.error);
        }
      } catch (err) {
        console.error("Error re-enabling scanner:", err);
      }
    }, delay);
  };

  const initializeScanner = async () => {
    if (!scannerRef.current) return;
    
    try {
      // Reset state
      setResult(null);
      setError(null);
      setLicenseStatus(null);

      /* Dynamically import the two SDK packages loaded via the CDN */
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const core = await import("@scandit/web-datacapture-core");
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const barcode = await import("@scandit/web-datacapture-barcode");

      const {
        configure,
        DataCaptureView,
        DataCaptureContext,
        Camera,
        FrameSourceState
      } = core as any;

      const {
        BarcodeCapture,
        barcodeCaptureLoader,
        BarcodeCaptureSettings,
        Symbology
      } = barcode as any;

      /* Initialise the engine (downloads WASM files automatically) */
      console.log("Using license key from environment secret");
      await configure({
        licenseKey: (import.meta as any).env.VITE_SCANDIT_LICENSE_KEY || "",
        libraryLocation:
          "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/sdc-lib/",
        moduleLoaders: [barcodeCaptureLoader()]
      });
      
      // Update license status
      setLicenseStatus('initialized');

      /* Set up capture context & view */
      const context = await DataCaptureContext.create();
      contextRef.current = context;
      
      const view = new DataCaptureView();
      await view.setContext(context);
      view.connectToElement(scannerRef.current);

      /* Camera */
      const camera = Camera.default;
      await context.setFrameSource(camera);
      await camera.switchToDesiredState(FrameSourceState.On);

      /* Capture only QR codes */
      const settings = new BarcodeCaptureSettings();
      settings.enableSymbologies([Symbology.QR]);

      const capture = await BarcodeCapture.forContext(context, settings);
      captureRef.current = capture;
      
      capture.addListener({
        didScan: async (_mode: any, session: any) => {
          const code = session.newlyRecognizedBarcode;
          if (!code) return;
          
          // Disable capture while processing
          await capture.setEnabled(false);
          
          // Get barcode data
          const url = code.data;
          console.log("QR code detected:", url);
          
          // Process the code with validation
          await validateQrCode(url);
        }
      });
      await capture.setEnabled(true);

    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "فشل إعداد الماسح");
      setLicenseStatus('failed');
    }
  };

  const cleanupScanner = async () => {
    try {
      if (captureRef.current) {
        await captureRef.current.setEnabled(false);
      }
      if (contextRef.current) {
        await contextRef.current.dispose();
      }
      contextRef.current = null;
      captureRef.current = null;
    } catch (err) {
      console.error("Error cleaning up scanner:", err);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    
    if (open) {
      // Initialize scanner when dialog opens
      initializeScanner();
    } else {
      // Clean up resources when dialog closes
      cleanupScanner();
      
      // Reset states
      setError(null);
      setResult(null);
      setIsValidating(false);
      setLicenseStatus(null);
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

          {/* Scanner viewport */}
          <div className="relative h-full w-full bg-black flex items-center justify-center">
            <div
              ref={scannerRef}
              className="absolute inset-0 bg-black overflow-hidden"
            />
            
            {/* Scanner overlay - scanning guides */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-[70vmin] h-[70vmin] max-w-sm max-h-sm">
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
            
            {/* Validation overlay */}
            {isValidating && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
                <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-center text-white text-lg font-medium">جارٍ التحقق من الكود...</p>
                </div>
              </div>
            )}
            
            {/* Error state */}
            {error && (
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
                        resetScannerAfterDelay(0);
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
                      onClick={() => handleOpenChange(false)}
                    >
                      <span className="flex items-center gap-1">
                        <X className="h-4 w-4" />
                        العودة
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Result state */}
            {result && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
                <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
                    <span className="material-icons text-white text-3xl">check</span>
                  </div>
                  <p className="text-center text-white text-lg font-medium">{result}</p>
                </div>
              </div>
            )}

            {/* License status error */}
            {licenseStatus === 'failed' && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-40 p-6">
                <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm max-w-md w-full">
                  <div className="text-destructive font-bold text-lg mb-2">خطأ في تهيئة الماسح</div>
                  <div className="text-white/90 mb-4">
                    فشل في تهيئة ماسح الكود. قد يكون ذلك بسبب مشكلة في الاتصال بالإنترنت أو مشكلة في مفتاح الترخيص.
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="default" 
                      className="flex-1 bg-primary text-white hover:bg-primary/90" 
                      onClick={() => {
                        initializeScanner();
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Camera className="h-4 w-4" />
                        إعادة المحاولة
                      </span>
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 bg-transparent border-white/30 text-white hover:bg-white/10"
                      onClick={() => handleOpenChange(false)}
                    >
                      <span className="flex items-center gap-1">
                        <X className="h-4 w-4" />
                        إغلاق
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}