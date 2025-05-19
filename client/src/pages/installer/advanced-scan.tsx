import { useEffect, useRef, useState } from "react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import InstallerLayout from "@/components/layouts/installer-layout";

// Import the Scandit libraries
import * as ScanditCore from '@scandit/web-datacapture-core';
import * as ScanditBarcode from '@scandit/web-datacapture-barcode';

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

/**
 * Advanced scanner page – powered by Scandit Web SDK
 */
export default function AdvancedScanPage() {
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

  // State for scan success animation
  const [showSuccess, setShowSuccess] = useState(false);

  // Function to validate QR code
  const validateQrCode = async (url: string) => {
    setIsValidating(true);
    setError(null);
    setResult(null);
    setShowSuccess(false);

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

      // Step 3: Send to server for validation and processing - include userId in request
      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND)");
        setIsValidating(false);
        return;
      }
      
      const scanResult = await apiRequest(
        "POST", 
        "/api/scan-qr", 
        {
          uuid,
          userId: user.id
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
      setShowSuccess(true);
      
      // Hide success animation after a few seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      
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
      
      // Reset scanner after showing success for a moment
      resetScannerAfterDelay(2000);
      
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

  useEffect(() => {
    document.title = "مسح متقدم | برنامج مكافآت بريق";

    let dispose: (() => Promise<void>) | undefined;

    // Create and execute the scanner initialization as an async IIFE
    (async function initScanner() {
      try {
        console.log("Initializing Scandit scanner");
        
        // Access the imported Scandit modules
        const core = ScanditCore;
        const barcode = ScanditBarcode;

        const {
          configure,
          DataCaptureView,
          DataCaptureContext,
          Camera,
          FrameSourceState,
          TorchSwitchControl,
          NumberWithUnit,
          MeasureUnit,
          RectangularLocationSelection,
          VideoResolution,
          CameraSettings
        } = core;

        const {
          BarcodeCapture,
          barcodeCaptureLoader,
          BarcodeCaptureSettings,
          Symbology
        } = barcode;

        /* Initialize the engine (downloads WASM files automatically) */
        console.log("Configuring Scandit with license key");
        await configure({
          // In client side code, environment variables are exposed through import.meta.env
          // The prefix VITE_ is required for the variable to be exposed to the client
          licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || "AUzUi3h1HwJVESxqC1+q5QUjwEoWmcFHyYt6X+J+0rZfWxNNMqvjdSc6s0EaAYBfpwrvbU7MDl8XyVh/sk87WAEnuqNmKlTgTwV5bd/3R+T67a5V7IAJ6rlvpGkEoC5fDrY6F2tmIQaYGkxCkht/l+sC5AQBBw4JmGxsRzZafKTN0v5YQz79UkLYkgPJRGdNZVMnuLdxCxZdFpmnJfgNZ5nD0kR5RfWW5R5JN5uIDuKHEQPXGAjKi7UoM7C6mEXvX+f+Xz0bH0t91P9ERnIqJf0G6mTt9GVDV1ZCiECRHMlVn9S2qWt8UHU5hhOhZxXbOKrBN89+0Xr1uVoN12jqnzPVRGlKaQaYJDVN72Nf+D73J/FjsJHQ1NhR/gvENuubvTQu/CrFg/2N91iMxofJrU9nCAuJpKQ4NU+g6oe3HRNt2o0JKdE3Gm2D1LJoLIqxP3/JO7bgLtcfOSUXyqLJbrL7IdaD/FrRs0HbQkfh20jA9K4VTQ94oCFy3oXH0cNm4BxWsK3Q7PQdYyZNzHjbJAWXcVWw4wdL3FMKEC/cMQp1k6Y97g0ZoTIe6l2uw/bFZ2XXMw==",
          libraryLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/sdc-lib/",
          moduleLoaders: [barcodeCaptureLoader()]
        });
        
        // Update license status
        setLicenseStatus('initialized');

        /* Set up capture context & view */
        const context = await DataCaptureContext.create();
        contextRef.current = context; // Store context in ref
        
        const view = new DataCaptureView();
        await view.setContext(context);
        view.connectToElement(scannerRef.current!);
        
        // 🔦 Torch toggle button (auto-hides if torch not available)
        const torchSwitch = new TorchSwitchControl();
        await view.addControl(torchSwitch);

        /* Camera with optimized settings */
        const camera = Camera.default;
        await context.setFrameSource(camera);
        
        // Optimization 3: Camera Settings
        const cameraSettings = new CameraSettings();
        cameraSettings.preferredResolution = VideoResolution.FullHD; // 1920 × 1080
        cameraSettings.zoomFactor = 1.3; // Helpful for small QR codes
        await camera.applySettings(cameraSettings);
        
        await camera.switchToDesiredState(FrameSourceState.On);

        /* Capture only QR codes with optimized settings */
        const settings = new BarcodeCaptureSettings();
        settings.enableSymbologies([Symbology.QR]);
        
        // Optimization 1: Rectangular location selection (focused scan area)
        const width = new NumberWithUnit(0.8, MeasureUnit.Fraction); // 80% of the view
        const heightToWidth = 1; // Square finder
        const locationSelection = RectangularLocationSelection.withWidthAndAspectRatio(
          width, heightToWidth
        );
        settings.locationSelection = locationSelection;
        
        // Optimization 2: Smart scan intention to reduce duplicate scans
        // This property is optional and may not exist in all versions
        if ('scanIntention' in settings) {
          settings.scanIntention = barcode.ScanIntention?.Smart;
        }

        const capture = await BarcodeCapture.forContext(context, settings);
        captureRef.current = capture; // Store capture in ref
        
        capture.addListener({
          didScan: async (_mode: any, session: any) => {
            const code = session.newlyRecognizedBarcodes?.[0];
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

        /* Provide disposer so we shut everything down on unmount */
        dispose = async () => {
          await capture.setEnabled(false);
          await context.dispose();
        };
      } catch (e: any) {
        console.error("Scandit initialization error:", e);
        setError(e?.message ?? "فشل إعداد الماسح");
        setLicenseStatus('failed');
      }
    })(); // Execute the async function immediately

    // Cleanup function
    return () => {
      if (dispose) dispose().catch(console.error);
    };
  }, []);

  return (
    <InstallerLayout activeTab="advanced-scan">
      {/* Full height container */}
      <div className="flex flex-col h-[calc(100dvh-4.5rem)]">
        {/* Header */}
        <div className="px-4 py-3 bg-white shadow-sm z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">المسح المتقدم (Scandit)</h1>
            
            {/* License Status Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xs">حالة الترخيص:</span>
              <div className={`h-2.5 w-2.5 rounded-full ${
                licenseStatus === 'initialized' ? 'bg-green-500' : 
                licenseStatus === 'failed' ? 'bg-red-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-xs">
                {licenseStatus === 'initialized' ? 'مفعّل' : 
                 licenseStatus === 'failed' ? 'فشل التفعيل' : 'جاري التحميل...'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Scanner viewport - flex-grow to take all available space */}
        <div className="flex-1 relative">
          <div
            ref={scannerRef}
            className="absolute inset-0 bg-black overflow-hidden"
          />
          
          {/* Scanner overlay - scanning guides (80% of view as square to match locationSelection) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[80vmin] h-[80vmin] max-w-sm max-h-sm">
                {/* Scan animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-scanline"></div>
                
                {/* Visual border to indicate the scan area */}
                <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-md"></div>
                
                {/* Corners */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary"></div>
              </div>
            </div>
            
            {/* Scanning instruction message */}
            <div className="absolute bottom-20 left-0 right-0 flex justify-center">
              <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                وجه الكاميرا نحو رمز QR الخاص بالمنتج
              </div>
            </div>
          </div>
          
          {/* Validation overlay */}
          {isValidating && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-40">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-center text-white text-lg font-medium">جارٍ التحقق من الكود...</p>
            </div>
          )}
          
          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-40">
              <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm max-w-md w-full">
                <div className="text-red-500 font-bold text-lg mb-2">حدث خطأ</div>
                <div className="text-white/90 whitespace-pre-wrap mb-4 max-h-[50vh] overflow-y-auto">
                  {error}
                </div>
                <Button 
                  variant="default" 
                  className="w-full bg-primary text-white hover:bg-primary/90 mt-4" 
                  onClick={() => setError(null)}
                >
                  المحاولة مرة أخرى
                </Button>
              </div>
            </div>
          )}
          
          {/* License failure state */}
          {licenseStatus === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 z-50">
              <p className="text-lg font-medium mb-4">فشل تهيئة الماسح المتقدم</p>
              <p className="text-sm text-gray-300 mb-6">يرجى التأكد من صحة مفتاح الترخيص والمحاولة مرة أخرى.</p>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
              >
                إعادة المحاولة
              </Button>
            </div>
          )}
          
          {/* Success overlay */}
          {showSuccess && (
            <div className="absolute inset-0 bg-green-600/80 flex flex-col items-center justify-center z-40">
              <div className="bg-white/20 p-8 rounded-full backdrop-blur-sm">
                <div className="text-white text-6xl">✓</div>
              </div>
              <p className="text-center text-white text-xl font-bold mt-6">{result}</p>
            </div>
          )}
        </div>
      </div>
    </InstallerLayout>
  );
}