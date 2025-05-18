import { useEffect, useRef, useState } from "react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2 } from "lucide-react";
import InstallerLayout from "@/components/layouts/installer-layout";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

/**
 * Advanced scanner page – powered by Scandit Web SDK
 * Note: Scandit modules are pulled dynamically via CDN import-map (see index.html).
 *       TS doesn't know their types at build-time, so we use the `any` escape hatch.
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

      // Step 3: Send to server for validation and processing
      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND)");
        setIsValidating(false);
        return;
      }
      
      // No longer need to send userId - server will get it from the session
      const scanResult = await apiRequest(
        "POST", 
        "/api/scan-qr", 
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

    (async () => {
      try {
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
          FrameSourceState,
          TorchSwitchControl,
          NumberWithUnit,
          MeasureUnit,
          RectangularLocationSelection,
          VideoResolution,
          CameraSettings,
          ScanIntention
        } = core as any;

        const {
          BarcodeCapture,
          barcodeCaptureLoader,
          BarcodeCaptureSettings,
          Symbology,
          SymbologyDescription
        } = barcode as any;

        /* Initialise the engine (downloads WASM files automatically) */
        console.log("Using license key from environment secret");
        await configure({
          licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || "",
          libraryLocation:
            "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/sdc-lib/",
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
        // Try different possible locations of ScanIntention based on Scandit's structure
        if (barcode.ScanIntention) {
          settings.scanIntention = barcode.ScanIntention.Smart;
        } else if (core.ScanIntention) {
          settings.scanIntention = core.ScanIntention.Smart;
        } else {
          console.log("ScanIntention not found in API, skipping this optimization");
        }

        const capture = await BarcodeCapture.forContext(context, settings);
        captureRef.current = capture; // Store capture in ref
        
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

        /* Provide disposer so we shut everything down on unmount */
        dispose = async () => {
          await capture.setEnabled(false);
          await context.dispose();
        };
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "فشل إعداد الماسح");
        setLicenseStatus('failed');
      }
    })();

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
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
              <div className="bg-black/50 p-6 rounded-xl backdrop-blur-sm flex flex-col items-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-center text-white text-lg font-medium">جارٍ التحقق من الكود...</p>
              </div>
            </div>
          )}
          
          {/* Success animation overlay */}
          {showSuccess && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 animate-fade-in">
              <div className="bg-green-600/80 p-8 rounded-full backdrop-blur-sm flex flex-col items-center animate-scale-up">
                <div className="h-24 w-24 rounded-full border-4 border-white flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white animate-success-check" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          {/* Floating Result Panel (instead of static bottom status bar) */}
          <div className={`absolute bottom-6 left-4 right-4 transition-all duration-300 ${(result || error) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl overflow-hidden">
              <div className={`px-5 py-4 ${result ? 'border-l-4 border-green-500' : error ? 'border-l-4 border-red-500' : ''}`}>
                {result && (
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">تم التحقق من المنتج بنجاح</h3>
                      <p className="text-green-600 font-medium text-sm mt-1">{result}</p>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">فشل التحقق</h3>
                      <p className="text-red-600 text-sm mt-1 whitespace-pre-wrap">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Environment info (only visible in dev mode) - now floating in corner */}
          {import.meta.env.DEV && (
            <div className="absolute bottom-2 left-2 p-2 bg-black/50 text-white rounded-lg text-xs z-10">
              <p className="font-mono">License: {import.meta.env.VITE_SCANDIT_LICENSE_KEY ? '✓' : '✗'}</p>
            </div>
          )}
        </div>
      </div>
    </InstallerLayout>
  );
}