import { useState, useEffect, useRef } from "react";
import * as ScanditBarcode from "@scandit/web-datacapture-barcode";
import * as ScanditCore from "@scandit/web-datacapture-core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, X, Camera as CameraIcon, Scan } from "lucide-react";
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
  
  // Scandit refs
  const contextRef = useRef<ScanditCore.DataCaptureContext | null>(null);
  const viewRef = useRef<ScanditCore.DataCaptureView | null>(null);
  const barcodeTrackingRef = useRef<ScanditBarcode.BarcodeTracking | null>(null);
  const cameraRef = useRef<ScanditCore.Camera | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize Scandit only once when component is mounted
  useEffect(() => {
    // A simpler approach for now - in a future iteration we can improve this
    // but for now let's focus on getting basic version working
    console.log("[SCANDIT DEBUG] Component mounted, configuring will happen when scan is requested");
    
    // Cleanup when component unmounts
    return () => {
      console.log("[SCANDIT DEBUG] Component unmounting, cleaning up scanner");
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    console.log("[SCANDIT DEBUG] Starting scanner...");
    setIsScanning(true);
    setError(null);
    
    try {
      // First configure Scandit with the license key
      console.log("[SCANDIT DEBUG] Attempting to configure Scandit...");
      
      try {
        await ScanditCore.configure({
          licenseKey: "AcQXJW5qOZMFbF8g+qfXS0TOxq1kkC0TxSFohuxDZ/gCYS6FWoYQQ80WAK61zPU59flE7GfkdM5IWVTZajB06T+2zBHh5jop9jKwLUVLJnZ71eD1fKO0NA==",
          libraryLocation: "/node_modules/@scandit",
          moduleLoaders: [
            { name: "barcode", load: () => Promise.resolve(ScanditBarcode) }
          ]
        });
        console.log("[SCANDIT DEBUG] Scandit configured successfully");
      } catch (configError) {
        console.error("[SCANDIT DEBUG] Error configuring Scandit:", configError);
        if (configError && typeof configError === 'object') {
          console.error("[SCANDIT DEBUG] Config error details:", {
            name: configError.name, 
            message: configError.message,
            stack: configError.stack
          });
        }
      }
      
      // Create DataCaptureContext if not already created
      if (!contextRef.current) {
        console.log("[SCANDIT DEBUG] Creating new DataCaptureContext");
        contextRef.current = new ScanditCore.DataCaptureContext();
      }
      
      // Initialize camera
      console.log("[SCANDIT DEBUG] Initializing camera...");
      if (!cameraRef.current) {
        console.log("[SCANDIT DEBUG] Getting default camera");
        const defaultCamera = ScanditCore.Camera.defaultCamera;
        console.log("[SCANDIT DEBUG] Default camera:", defaultCamera);
        
        if (!defaultCamera) {
          console.error("[SCANDIT DEBUG] No default camera available");
          throw new Error("No camera available");
        }
        
        cameraRef.current = defaultCamera;
        
        // Add camera to context
        console.log("[SCANDIT DEBUG] Setting camera as frame source");
        await contextRef.current.setFrameSource(cameraRef.current);
      }
      
      // Setup barcode tracking
      console.log("[SCANDIT DEBUG] Setting up barcode tracking");
      if (!barcodeTrackingRef.current) {
        try {
          // Create barcode tracking settings
          console.log("[SCANDIT DEBUG] Creating barcode tracking settings");
          const settings = new ScanditBarcode.BarcodeTrackingSettings();
          settings.scenario = ScanditBarcode.BarcodeTrackingScenario.A;
          
          // Enable only QR codes for performance
          console.log("[SCANDIT DEBUG] Enabling QR code symbology");
          settings.enableSymbologies([ScanditBarcode.Barcode.Symbology.QR]);
          
          // Create and attach barcode tracking to context
          console.log("[SCANDIT DEBUG] Creating barcode tracking for context");
          barcodeTrackingRef.current = ScanditBarcode.BarcodeTracking.forContext(contextRef.current, settings);
          
          // Add a listener for tracking results
          console.log("[SCANDIT DEBUG] Adding listener for barcode tracking");
          barcodeTrackingRef.current.addListener({
            didUpdateSession: (_, session) => {
              // Process tracked barcodes
              const trackedCodes = session.trackedBarcodes;
              const codeCount = Object.keys(trackedCodes).length;
              
              if (codeCount > 0) {
                console.log(`[SCANDIT DEBUG] Found ${codeCount} tracked codes`);
              }
              
              for (const identifier of Object.keys(trackedCodes)) {
                try {
                  const barcode = trackedCodes[identifier]?.barcode;
                  if (barcode && barcode.data) {
                    // We found a barcode, process it
                    const decodedText = barcode.data;
                    console.log("[SCANDIT DEBUG] QR code detected:", decodedText);
                    
                    // Stop scanning and validate the code
                    stopScanner();
                    validateQrCode(decodedText);
                    return;
                  }
                } catch (err) {
                  console.error("[SCANDIT DEBUG] Error processing barcode:", err);
                }
              }
            }
          });
        } catch (err) {
          console.error("[SCANDIT DEBUG] Error setting up barcode tracking:", err);
          throw err;
        }
      }
      
      try {
        // Start barcode tracking
        console.log("[SCANDIT DEBUG] Enabling barcode tracking");
        await barcodeTrackingRef.current.setEnabled(true);
        
        // Start camera
        console.log("[SCANDIT DEBUG] Switching camera to ON state");
        await cameraRef.current.switchToDesiredState(ScanditCore.FrameSourceState.On);
        
        // Create and setup the DataCaptureView for the UI
        if (!viewRef.current && containerRef.current) {
          console.log("[SCANDIT DEBUG] Creating DataCaptureView for UI");
          viewRef.current = ScanditCore.DataCaptureView.forContext(contextRef.current);
          
          try {
            // Add a basic overlay to show the tracked barcodes
            console.log("[SCANDIT DEBUG] Creating barcode tracking overlay");
            const overlay = ScanditBarcode.BarcodeTrackingBasicOverlay.withBarcodeTrackingForViewWithStyle(
              barcodeTrackingRef.current,
              viewRef.current,
              ScanditBarcode.BarcodeTrackingBasicOverlayStyle.Frame
            );
            
            console.log("[SCANDIT DEBUG] Created overlay:", overlay ? "success" : "failed");
            
            // Add camera controls
            console.log("[SCANDIT DEBUG] Adding camera controls");
            viewRef.current.addControl(new ScanditCore.TorchControl());
            viewRef.current.addControl(new ScanditCore.CameraSwitchControl());
          } catch (err) {
            console.error("[SCANDIT DEBUG] Error adding overlay or controls:", err);
          }
          
          // Connect the view to the HTML container
          console.log("[SCANDIT DEBUG] Connecting view to HTML container");
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
            viewRef.current.connectToElement(containerRef.current);
            console.log("[SCANDIT DEBUG] View connected to container");
          } else {
            console.error("[SCANDIT DEBUG] Container reference is null");
          }
        }
      } catch (err) {
        console.error("[SCANDIT DEBUG] Error in final setup steps:", err);
        throw err;
      }
      
    } catch (err: any) {
      console.error("Error starting Scandit scanner:", err);
      
      console.error("[SCANDIT DEBUG] Full error:", err);
      
      // Check for Scandit error in a safer way
      if (err && typeof err === 'object') {
        console.log("[SCANDIT DEBUG] Error props:", Object.keys(err));
        
        if ('name' in err) {
          console.log("[SCANDIT DEBUG] Error name:", err.name);
          
          if (err.name === 'CameraNotAvailableError') {
            setError("الكاميرا غير متوفرة. (رمز الخطأ: CAMERA_NOT_AVAILABLE)");
          } else if (err.name === 'CameraAccessDeniedError') {
            setError("تم رفض الوصول إلى الكاميرا. يرجى منح الإذن. (رمز الخطأ: CAMERA_ACCESS_DENIED)");
          } else if (err.name === 'NoLicenseKeyError' || err.name === 'LicenseKeyError') {
            setError("مفتاح الترخيص لمسح الباركود غير صالح. (رمز الخطأ: LICENSE_KEY_ERROR)");
          } else if (err.name === 'MisconfigurationError') {
            setError("خطأ في إعدادات الماسح الضوئي. (رمز الخطأ: MISCONFIGURATION_ERROR)");
          } else {
            setError(`خطأ في تشغيل الماسح: ${err.message || err.name || "UNKNOWN"}`);
          }
        } else {
          console.log("[SCANDIT DEBUG] Error has no name property");
          
          if ('message' in err) {
            setError(`خطأ في تشغيل الماسح: ${err.message}`);
          } else {
            // Try to stringify the error
            try {
              const errorString = JSON.stringify(err);
              setError(`خطأ في تشغيل الماسح: ${errorString}`);
            } catch {
              setError("خطأ غير معروف في تشغيل الماسح الضوئي.");
            }
          }
        }
      } else {
        console.log("[SCANDIT DEBUG] Error is not an object:", typeof err, err);
        setError(`فشل بدء تشغيل الماسح الضوئي. (رمز الخطأ: ${err && err.toString ? err.toString() : "UNKNOWN_ERROR"})`);
      }
      
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    console.log("[SCANDIT DEBUG] Stopping scanner...");
    
    try {
      // Disable barcode tracking
      if (barcodeTrackingRef.current) {
        console.log("[SCANDIT DEBUG] Disabling barcode tracking");
        try {
          await barcodeTrackingRef.current.setEnabled(false);
          console.log("[SCANDIT DEBUG] Barcode tracking disabled successfully");
        } catch (err) {
          console.error("[SCANDIT DEBUG] Error disabling barcode tracking:", err);
        }
        barcodeTrackingRef.current = null;
        console.log("[SCANDIT DEBUG] Barcode tracking reference cleared");
      } else {
        console.log("[SCANDIT DEBUG] No barcode tracking to disable");
      }
      
      // Turn off camera
      if (cameraRef.current) {
        if (cameraRef.current.desiredState !== ScanditCore.FrameSourceState.Off) {
          console.log("[SCANDIT DEBUG] Turning off camera");
          try {
            await cameraRef.current.switchToDesiredState(ScanditCore.FrameSourceState.Off);
            console.log("[SCANDIT DEBUG] Camera turned off successfully");
          } catch (err) {
            console.error("[SCANDIT DEBUG] Error turning off camera:", err);
          }
        } else {
          console.log("[SCANDIT DEBUG] Camera is already off");
        }
        cameraRef.current = null;
        console.log("[SCANDIT DEBUG] Camera reference cleared");
      } else {
        console.log("[SCANDIT DEBUG] No camera to turn off");
      }
      
      // Clear the view reference
      if (viewRef.current && containerRef.current) {
        console.log("[SCANDIT DEBUG] Disconnecting view from container");
        try {
          containerRef.current.innerHTML = '';
          console.log("[SCANDIT DEBUG] Container cleared");
          viewRef.current = null;
          console.log("[SCANDIT DEBUG] View reference cleared");
        } catch (err) {
          console.error("[SCANDIT DEBUG] Error clearing view:", err);
        }
      } else {
        console.log("[SCANDIT DEBUG] No view/container to clear");
      }
      
      // Clear the context reference
      if (contextRef.current) {
        console.log("[SCANDIT DEBUG] Clearing context reference");
        try {
          contextRef.current = null;
          console.log("[SCANDIT DEBUG] Context reference cleared");
        } catch (err) {
          console.error("[SCANDIT DEBUG] Error clearing context:", err);
        }
      }
      
      console.log("[SCANDIT DEBUG] Scanner stopped successfully");
      setIsScanning(false);
    } catch (error) {
      console.error("[SCANDIT DEBUG] Global error in stopScanner:", error);
      setIsScanning(false);
    }
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
        title: "تم التحقق من المنتج بنجاح ✓",
        description: `المنتج: ${result.productName || "غير معروف"}\nالنقاط المكتسبة: ${result.pointsAwarded || 10}`,
        variant: "default",
      });
      
      if (onScanSuccess) {
        onScanSuccess(result.productName);
      }
      
    } catch (err: any) {
      console.error("Validation error:", err);
      setError(`خطأ في التحقق من رمز QR. يرجى المحاولة مرة أخرى. (رمز الخطأ: VALIDATION_ERROR)\n\nتفاصيل: ${err.message || "خطأ غير معروف"}`);
      setIsValidating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    console.log("[SCANDIT DEBUG] Dialog state changing to:", open ? "open" : "closed");
    setIsOpen(open);
    
    if (!open) {
      console.log("[SCANDIT DEBUG] Dialog closing, stopping scanner");
      stopScanner();
    } else {
      console.log("[SCANDIT DEBUG] Dialog opening");
    }
    
    // Reset states when dialog is closed
    if (!open) {
      console.log("[SCANDIT DEBUG] Resetting scanner state");
      setError(null);
      setIsScanning(false);
      setIsValidating(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          console.log("[SCANDIT DEBUG] QR scan button clicked");
          setIsOpen(true);
        }}
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
                      variant="default" 
                      className="flex-1 bg-primary text-white hover:bg-primary/90" 
                      onClick={() => setError(null)}
                    >
                      <span className="flex items-center gap-1">
                        <CameraIcon className="h-4 w-4" />
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
            ) : (
              <>
                {/* Scandit Scanner container */}
                <div
                  ref={containerRef}
                  className="w-full h-full"
                ></div>

                {/* Scanner overlay - guidance text */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    <div className="absolute bottom-24 left-0 right-0 flex justify-center">
                      <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                        وجه الكاميرا نحو رمز QR الخاص بالمنتج
                      </div>
                    </div>
                  </div>
                )}

                {/* Scanner controls */}
                <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-30 ${isScanning ? '' : 'bg-black/90 bottom-0 top-0 flex items-center justify-center'}`}>
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
                        <CameraIcon className="h-5 w-5" />
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