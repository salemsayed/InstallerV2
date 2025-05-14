import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, X, Scan } from "lucide-react";
import { Camera as CameraIcon } from "lucide-react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useAuth } from "@/hooks/auth-provider";
// Import necessary Scandit modules - using import type for better bundling
import { Barcode, BarcodeCapture, BarcodeCaptureListener, BarcodeCaptureSession, BarcodeCaptureSettings, SymbologySettings } from 'scandit-web-datacapture-barcode';

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
  
  // References for Scandit SDK elements
  const scanditRef = useRef<{
    context: any;
    camera: any;
    barcodeCapture: any;
    view: any;
    isInitialized: boolean;
  }>({
    context: null,
    camera: null,
    barcodeCapture: null,
    view: null,
    isInitialized: false
  });
  
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const scanditLibraryLoadedRef = useRef(false);

  // Load Scandit library and engine only once
  useEffect(() => {
    // Clean up on component unmount
    return () => {
      stopScanner();
    };
  }, []);

  // Completely separate initializing Scandit from connecting it to the DOM
  const initializeScandit = async () => {
    // If already initialized, use the existing instance
    if (scanditRef.current.isInitialized) {
      console.log("Scandit already initialized, reusing instance");
      return true;
    }
    
    try {
      // Make sure we have a logged in user
      if (!user) {
        throw new Error("User must be logged in to access the scanner");
      }
      
      console.log("Starting Scandit initialization");
      
      // First step: Load the Scandit library modules if not already loaded
      if (!scanditLibraryLoadedRef.current) {
        console.log("Loading Scandit library modules");
        try {
          // Dynamic import of Scandit modules - this loads the library on demand
          const ScanditSDK = await import('scandit-web-datacapture-barcode');
          const ScanditCore = await import('scandit-web-datacapture-core');
          
          // Store these for later use
          window.ScanditSDK = ScanditSDK;
          window.ScanditCore = ScanditCore;
          scanditLibraryLoadedRef.current = true;
          console.log("Scandit library modules loaded successfully");
        } catch (moduleError) {
          console.error("Failed to load Scandit library modules:", moduleError);
          throw new Error(`Failed to load Scandit: ${moduleError.message}`);
        }
      }
      
      // Get the library modules from window object
      const { ScanditSDK, ScanditCore } = window as any;
      
      // Second step: Fetch the license key from our API endpoint
      console.log("Fetching Scandit license key for user:", user.id);
      let licenseKey = "";
      
      try {
        console.log(`Requesting Scandit license key from server for user ID: ${user.id}`);
        
        const licenseResponse = await fetch(`/api/scandit-license?userId=${user.id}`);
        const licenseData = await licenseResponse.json();
        
        if (!licenseResponse.ok) {
          throw new Error(
            `Server returned ${licenseResponse.status}: ${licenseResponse.statusText}. ` +
            `Details: ${licenseData.message || 'Unknown error'} (${licenseData.error_code || 'NO_CODE'})`
          );
        }
        
        if (!licenseData.success) {
          throw new Error(`Server response indicated failure: ${licenseData.message || 'Unknown error'}`);
        }
        
        licenseKey = licenseData.licenseKey;
        
        console.log("Using Scandit license key from API:", licenseKey ? "Available ✓" : "Not found ✗");
        
        if (!licenseKey) {
          throw new Error("License key was empty or null in the server response");
        }
      } catch (licenseError) {
        console.error("Failed to get Scandit license key from server:", licenseError);
        throw new Error(`Failed to get Scandit license key: ${licenseError.message}`);
      }
      
      // Third step: Create and configure the Scandit components
      console.log("Creating Scandit components");
      
      try {
        // Create and configure the data capture context
        const context = await ScanditCore.DataCaptureContext.create(licenseKey);
        console.log("Created Scandit context");
        
        // Configure the camera
        const camera = ScanditCore.Camera.default;
        await context.setFrameSource(camera);
        console.log("Configured camera");
        
        // Configure barcode settings to scan only QR codes
        const settings = new ScanditSDK.BarcodeCaptureSettings();
        // Disable all symbologies by default
        settings.enableSymbologies([ScanditSDK.Symbology.QR], true);
        console.log("Configured barcode settings");
        
        // Configure viewfinder
        const barcodeCapture = ScanditSDK.BarcodeCapture.forContext(context, settings);
        console.log("Created barcode capture");
        
        // Create UI components
        const view = ScanditCore.DataCaptureView.forContext(context);
        console.log("Created data capture view");
        
        // Add visual feedback when scanning occurs
        const overlay = ScanditSDK.BarcodeCaptureOverlay.withBarcodeCaptureForView(barcodeCapture, view);
        overlay.viewfinder = new ScanditCore.RectangularViewfinder(
          ScanditCore.RectangularViewfinderStyle.Square,
          ScanditCore.RectangularViewfinderLineStyle.Light
        );
        console.log("Configured overlay and viewfinder");
        
        // Save references
        scanditRef.current = {
          context,
          camera,
          barcodeCapture,
          view,
          isInitialized: true
        };
        
        console.log("Scandit components created and saved successfully");
      } catch (componentError) {
        console.error("Failed to create Scandit components:", componentError);
        throw new Error(`Failed to create Scandit components: ${componentError.message}`);
      }
      
      try {
        // Fourth step: Set up scan listener
        console.log("Setting up barcode scan listener");
        scanditRef.current.barcodeCapture.addListener({
          didScan: (_, session) => {
            if (session.newlyRecognizedBarcodes.length > 0) {
              const barcode = session.newlyRecognizedBarcodes[0];
              if (barcode.data) {
                console.log("Barcode detected:", barcode.data);
                handleScanSuccess(barcode.data);
              }
            }
          }
        });
        console.log("Scan listener set up successfully");
        
        console.log("Scandit initialization completed successfully");
        return true;
      } catch (listenerError) {
        console.error("Failed to set up scan listener:", listenerError);
        throw new Error(`Failed to set up scan listener: ${listenerError.message}`);
      }
    } catch (error) {
      console.error("Failed to initialize Scandit:", error);
      setError(`فشل في تهيئة الماسح الضوئي. (رمز الخطأ: SCANDIT_INIT_ERROR)\n\nتفاصيل: ${error.message}`);
      return false;
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    console.log("Starting scanner process");
    
    // Make sure user is logged in before starting scanner
    if (!user) {
      console.error("No user logged in");
      setError("يجب تسجيل الدخول لاستخدام الماسح. (رمز الخطأ: USER_NOT_LOGGED_IN)");
      setIsScanning(false);
      return;
    }
    
    try {
      // Step 1: Initialize Scandit components (but don't connect to DOM yet)
      console.log("Initializing Scandit components");
      const initialized = await initializeScandit();
      if (!initialized) {
        console.error("Failed to initialize Scandit");
        setError("فشل في تهيئة الماسح الضوئي. (رمز الخطأ: SCANDIT_INIT_ERROR)");
        setIsScanning(false);
        return;
      }
      
      // Step 2: Ensure scanner container element is available
      // We need to wait for the next render cycle to ensure the DOM is updated
      console.log("Waiting for scanner container element to be ready");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!scannerContainerRef.current) {
        console.error("Scanner container element not found in DOM after delay");
        setError("عنصر الماسح الضوئي غير موجود. (رمز الخطأ: ELEMENT_NOT_FOUND)");
        setIsScanning(false);
        return;
      }
      
      // Step 3: Connect view to DOM element and start camera
      try {
        // Get container dimensions to verify it's properly rendered
        const rect = scannerContainerRef.current.getBoundingClientRect();
        console.log(`Scanner container dimensions: ${rect.width}x${rect.height}`);
        
        if (rect.width === 0 || rect.height === 0) {
          throw new Error("Scanner container has zero dimensions");
        }
        
        // Connect view to DOM element
        console.log("Connecting Scandit view to DOM element");
        await scanditRef.current.view.connectToElement(scannerContainerRef.current);
        console.log("Successfully connected Scandit view to DOM element");
        
        // Start camera
        const { ScanditCore } = window as any;
        console.log("Starting camera");
        await scanditRef.current.camera.switchToDesiredState(ScanditCore.FrameSourceState.On);
        console.log("Camera started successfully");
        
        // Enable barcode capture
        console.log("Enabling barcode capture");
        scanditRef.current.barcodeCapture.isEnabled = true;
        console.log("Barcode capture enabled successfully");
        
        console.log("Scanner started successfully");
      } catch (error) {
        console.error("Error connecting scanner to DOM or starting camera:", error);
        setError(`فشل تشغيل الماسح الضوئي. (رمز الخطأ: SCANNER_CONNECT_ERROR)\n\nتفاصيل: ${error.message}`);
        setIsScanning(false);
        
        // Attempt to clean up
        try {
          if (scanditRef.current.camera) {
            console.log("Attempting to clean up camera resources");
            await scanditRef.current.camera.switchToDesiredState((window as any).ScanditCore.FrameSourceState.Off);
          }
        } catch (cleanupError) {
          console.error("Failed to clean up camera resources:", cleanupError);
        }
      }
    } catch (err) {
      console.error("Unexpected error starting scanner:", err);
      setError(`فشل غير متوقع. يرجى المحاولة مرة أخرى. (رمز الخطأ: UNEXPECTED_ERROR)\n\nتفاصيل: ${err.message}`);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (!scanditRef.current.isInitialized) return;
    
    try {
      if (scanditRef.current.barcodeCapture) {
        scanditRef.current.barcodeCapture.isEnabled = false;
      }
      
      if (scanditRef.current.camera) {
        const { ScanditCore } = window as any;
        if (ScanditCore) {
          await scanditRef.current.camera.switchToDesiredState(ScanditCore.FrameSourceState.Off);
        }
      }
    } catch (err) {
      console.error("Error stopping scanner:", err);
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

    console.log("Validating QR code:", url);

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

  // Check if Scandit license key is available and log the status
  useEffect(() => {
    // Log all available environment variables (excluding their values for security)
    console.log("Available environment variables:", 
      Object.keys(import.meta.env)
        .filter(key => key.startsWith('VITE_') || key === 'SCANDIT_LICENSE_KEY')
        .map(key => `${key}: ${key === 'SCANDIT_LICENSE_KEY' ? '✓' : '✓'}`)
    );
    
    if (import.meta.env.SCANDIT_LICENSE_KEY) {
      console.log("Scandit license key is available.");
    } else {
      console.error("Warning: No Scandit license key found in environment variables.");
    }
  }, []);

  // Track when scanner container is mounted and ready
  useEffect(() => {
    if (isScanning && scannerContainerRef.current) {
      console.log("Scanner container element is now available in the DOM");
    }
  }, [isScanning, scannerContainerRef.current]);

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
                {/* Scandit Scanner View - always rendered but only visible when scanning */}
                <div 
                  id="scandit-barcode-picker"
                  ref={scannerContainerRef}
                  className={`w-full h-full ${isScanning ? 'block' : 'hidden'}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#000',
                    zIndex: 5
                  }}
                />

                {/* Scanner guidance overlay */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    {/* Scanning area visualization - shows a square outline */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative w-[70vmin] h-[70vmin] max-w-md max-h-md">
                        {/* Scan animation - moving horizontal line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-primary animate-scanline"></div>
                        
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary"></div>
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-primary"></div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary"></div>
                      </div>
                    </div>
                    
                    {/* Instruction label */}
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