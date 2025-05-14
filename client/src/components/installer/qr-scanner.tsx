import { useState, useEffect, useRef } from "react";
import * as ScanditBarcode from "@scandit/web-datacapture-barcode";
import * as ScanditCore from "@scandit/web-datacapture-core";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, X, Camera as CameraIcon, Scan, ZapIcon } from "lucide-react";
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
  const [usingScandit, setUsingScandit] = useState(true);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  
  // Html5QrCode ref
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  
  // Scandit refs
  const contextRef = useRef<ScanditCore.DataCaptureContext | null>(null);
  const viewRef = useRef<ScanditCore.DataCaptureView | null>(null);
  const barcodeTrackingRef = useRef<ScanditBarcode.BarcodeTracking | null>(null);
  const cameraRef = useRef<ScanditCore.Camera | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize Scandit only once when component is mounted
  useEffect(() => {
    // Configure Scandit with the license key
    const initializeScandit = async () => {
      try {
        await ScanditCore.configure({
          licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || '',
          libraryLocation: '/node_modules/@scandit',
          moduleLoaders: []
        });
        console.log("Scandit configured successfully");
        setUsingScandit(true);
      } catch (error) {
        console.error("Error configuring Scandit:", error);
        setUsingScandit(false);
      }
    };
    
    initializeScandit();
    
    // Cleanup when component unmounts
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    if (usingScandit) {
      await startScanditScanner();
    } else {
      await startHtml5QrScanner();
    }
  };

  const startScanditScanner = async () => {
    try {
      // Create DataCaptureContext if not already created
      if (!contextRef.current) {
        contextRef.current = new ScanditCore.DataCaptureContext();
      }
      
      // Initialize camera
      if (!cameraRef.current) {
        cameraRef.current = ScanditCore.Camera.defaultCamera;
        if (!cameraRef.current) {
          throw new Error("No camera available");
        }
        
        // Add camera to context
        await contextRef.current.setFrameSource(cameraRef.current);
      }
      
      // Setup barcode tracking
      if (!barcodeTrackingRef.current) {
        // Create barcode tracking settings
        const settings = new ScanditBarcode.BarcodeTrackingSettings();
        settings.scenario = ScanditBarcode.BarcodeTrackingScenario.A;
        
        // Enable only QR codes for performance
        settings.enableSymbologies([ScanditBarcode.Barcode.Symbology.QR]);
        
        // Create and attach barcode tracking to context
        barcodeTrackingRef.current = ScanditBarcode.BarcodeTracking.forContext(contextRef.current, settings);
        
        // Add a listener for tracking results
        barcodeTrackingRef.current.addListener({
          didUpdateSession: (_, session) => {
            // Process tracked barcodes
            const trackedCodes = session.trackedBarcodes;
            for (const identifier of Object.keys(trackedCodes)) {
              const barcode = trackedCodes[identifier]?.barcode;
              if (barcode && barcode.data) {
                // We found a barcode, process it
                const decodedText = barcode.data;
                console.log("QR code detected (Scandit):", decodedText);
                
                // Stop scanning and validate the code
                stopScanner();
                validateQrCode(decodedText);
                return;
              }
            }
          }
        });
      }
      
      // Start barcode tracking
      await barcodeTrackingRef.current.setEnabled(true);
      
      // Start camera
      await cameraRef.current.switchToDesiredState(ScanditCore.FrameSourceState.On);
      
      // Create and setup the DataCaptureView for the UI
      if (!viewRef.current && containerRef.current) {
        viewRef.current = ScanditCore.DataCaptureView.forContext(contextRef.current);
        
        // Add a basic overlay to show the tracked barcodes
        const overlay = ScanditBarcode.BarcodeTrackingBasicOverlay.withBarcodeTrackingForViewWithStyle(
          barcodeTrackingRef.current,
          viewRef.current,
          ScanditBarcode.BarcodeTrackingBasicOverlayStyle.Frame
        );
        
        // Add camera controls
        viewRef.current.addControl(new ScanditCore.TorchControl());
        viewRef.current.addControl(new ScanditCore.CameraSwitchControl());
        
        // Connect the view to the HTML container
        containerRef.current.innerHTML = '';
        viewRef.current.connectToElement(containerRef.current);
      }
      
    } catch (err: any) {
      console.error("Error starting Scandit scanner:", err);
      
      if (err instanceof ScanditCore.ScanditError) {
        if (err.code === ScanditCore.ScanditEngineErrorCode.CAMERA_NOT_AVAILABLE) {
          console.log("Falling back to HTML5-QRCode due to camera issue");
          setUsingScandit(false);
          await startHtml5QrScanner();
        } else if (err.code === ScanditCore.ScanditEngineErrorCode.CAMERA_ACCESS_DENIED) {
          setError("تم رفض الوصول إلى الكاميرا. يرجى منح الإذن. (رمز الخطأ: CAMERA_ACCESS_DENIED)");
          setIsScanning(false);
        } else {
          console.log("Falling back to HTML5-QRCode due to Scandit error:", err.code);
          setUsingScandit(false);
          await startHtml5QrScanner();
        }
      } else {
        console.log("Falling back to HTML5-QRCode due to error");
        setUsingScandit(false);
        await startHtml5QrScanner();
      }
    }
  };

  const startHtml5QrScanner = async () => {
    try {
      // If we're using HTML5-QRCode, we need a different container
      if (!qrContainerRef.current) {
        console.error("QR container ref not available");
        setError("عنصر الماسح الضوئي غير موجود (رمز الخطأ: ELEMENT_NOT_FOUND)");
        setIsScanning(false);
        return;
      }
      
      const qrCodeId = "qr-reader";
      
      // Create the element if it doesn't exist yet
      if (!document.getElementById(qrCodeId)) {
        const qrElement = document.createElement('div');
        qrElement.id = qrCodeId;
        qrElement.style.width = '100%';
        qrElement.style.height = '100%';
        qrContainerRef.current.innerHTML = '';
        qrContainerRef.current.appendChild(qrElement);
      }
      
      // Create a new Html5Qrcode instance
      html5QrcodeRef.current = new Html5Qrcode(qrCodeId);
      
      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Make QR box responsive - use 70% of the smaller dimension
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.7);
            return { width: boxSize, height: boxSize };
          },
          aspectRatio: window.innerHeight > window.innerWidth ? window.innerHeight / window.innerWidth : 1.0,
        },
        (decodedText) => {
          console.log("QR code detected (Html5Qrcode):", decodedText);
          stopHtml5QrScanner();
          validateQrCode(decodedText);
        },
        (errorMessage) => {
          // Don't show QR scanning errors to users
          console.log("QR scan error (Html5Qrcode):", errorMessage);
        }
      );
    } catch (err: any) {
      console.error("Error starting HTML5 QR Scanner:", err);
      setError(`فشل بدء تشغيل الماسح الضوئي. (رمز الخطأ: ${err.message || "HTML5_QR_ERROR"})`);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (usingScandit) {
      await stopScanditScanner();
    } else {
      await stopHtml5QrScanner();
    }
    
    setIsScanning(false);
  };

  const stopScanditScanner = async () => {
    try {
      // Disable barcode tracking
      if (barcodeTrackingRef.current) {
        await barcodeTrackingRef.current.setEnabled(false);
      }
      
      // Turn off camera
      if (cameraRef.current && cameraRef.current.desiredState !== ScanditCore.FrameSourceState.Off) {
        await cameraRef.current.switchToDesiredState(ScanditCore.FrameSourceState.Off);
      }
    } catch (error) {
      console.error("Error stopping Scandit scanner:", error);
    }
  };
  
  const stopHtml5QrScanner = async () => {
    try {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        await html5QrcodeRef.current.stop();
      }
    } catch (error) {
      console.error("Error stopping HTML5 QR scanner:", error);
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
    setIsOpen(open);
    
    if (!open) {
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
                  className={`w-full h-full ${!isScanning || !usingScandit ? 'hidden' : ''}`}
                ></div>
                
                {/* HTML5-QRCode Scanner container */}
                <div
                  ref={qrContainerRef}
                  className={`w-full h-full ${!isScanning || usingScandit ? 'hidden' : ''}`}
                ></div>

                {/* Scanner overlay - corners to guide scanning */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Add custom guidance elements for either scanner */}
                    <div className="absolute bottom-24 left-0 right-0 flex justify-center">
                      <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                        وجه الكاميرا نحو رمز QR الخاص بالمنتج
                      </div>
                    </div>
                    
                    {/* Custom scanning animation overlay for HTML5-QRCode */}
                    {!usingScandit && (
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
                    )}
                  </div>
                )}

                {/* Scanner controls */}
                <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-30 ${isScanning ? '' : 'bg-black/90 bottom-0 top-0 flex items-center justify-center'}`}>
                  {!isScanning ? (
                    <div className="flex flex-col items-center gap-6 max-w-md mx-auto p-4">
                      <Scan className="h-20 w-20 text-primary mb-4" />
                      <h3 className="text-white text-xl font-bold">مسح رمز QR للمنتج</h3>
                      <p className="text-white/70 text-center mb-6">قم بمسح رمز QR الموجود على المنتج للتحقق من أصالته وإضافة النقاط لحسابك</p>
                      {!usingScandit && (
                        <p className="text-amber-400/90 text-center text-sm mb-2">
                          <span className="inline-block px-2 py-1 bg-amber-400/20 rounded-md mb-1">ملاحظة:</span> يتم استخدام ماسح QR الاحتياطي
                        </p>
                      )}
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