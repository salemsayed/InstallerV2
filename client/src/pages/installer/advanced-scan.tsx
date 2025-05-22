import { useEffect, useRef, useState, useCallback } from "react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2, CheckCircle2, AlertCircle, Info, QrCode, TextCursorInput } from "lucide-react";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Button } from "@/components/ui/button";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

// Helper function to translate error details from English to Arabic
const translateErrorDetails = (details: string): string => {
  if (!details) return '';
  
  // Common server error translations
  if (details.includes("already been scanned") || details.includes("has been scanned")) {
    return "تم مسح هذا المنتج مسبقاً";
  }
  if (details.includes("not found") || details.includes("invalid")) {
    return "منتج غير صالح أو غير موجود";
  }
  if (details.includes("expired")) {
    return "انتهت صلاحية رمز المنتج";
  }
  if (details.includes("unauthorized") || details.includes("not allowed")) {
    return "غير مصرح لك بمسح هذا المنتج";
  }
  if (details.includes("limit") || details.includes("maximum")) {
    return "تم تجاوز الحد المسموح من المسح";
  }
  if (details.includes("duplicate")) {
    return "منتج مكرر";
  }
  if (details.includes("network") || details.includes("connection")) {
    return "خطأ في الاتصال بالشبكة";
  }
  
  // Default case - return original with note that it wasn't translated
  return details;
};

/**
 * Advanced scanner page with QR and Label (OCR) scanning capabilities
 * Powered by Scandit Web SDK with modules loaded via CDN import-map
 */
export default function AdvancedScanPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<'initialized' | 'failed' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  
  // Scanner mode state (QR or OCR)
  const [scannerMode, setScannerMode] = useState<'qr' | 'ocr'>('qr');
  const [statusMessage, setStatusMessage] = useState<string>("جارٍ البحث عن رمز QR...");
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState<boolean>(true);
  
  // References to context and capture objects
  const contextRef = useRef<any>(null);
  const barcodeCaptureRef = useRef<any>(null); // For QR mode
  const labelCaptureRef = useRef<any>(null); // For OCR mode
  
  // Timers for auto-switching between modes
  const modeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State for scan result notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | null>(null);
  
  // Helper function for haptic feedback
  const triggerHapticFeedback = useCallback((pattern: number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.error('Haptic feedback failed:', e);
      }
    }
  }, []);

  // Function to validate QR code
  const validateQrCode = async (url: string) => {
    setIsValidating(true);
    setError(null);
    setResult(null);
    setShowNotification(false);

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
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]); // Error vibration pattern
        
        // Auto-dismiss error after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        resetScannerAfterDelay();
        return;
      }

      const uuid = warrantyMatch ? warrantyMatch[1] : shortMatch![1];
      console.log("Extracted UUID:", uuid);

      // Step 2: UUID validation
      if (!isValidUUIDv4(uuid)) {
        setError("رمز المنتج UUID غير صالح. يرجى مسح رمز ضمان صالح. (رمز الخطأ: INVALID_UUID)\n\nالرمز المكتشف: " + uuid);
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]); // Error vibration pattern
        
        // Auto-dismiss error after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        resetScannerAfterDelay();
        return;
      }

      // Step 3: Send to server for validation and processing
      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND)");
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]); // Error vibration pattern
        
        // Auto-dismiss error after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        return;
      }
      
      console.log("Sending QR scan request with:", {
        endpoint: `/api/scan-qr`,
        user: user,
        uuid: uuid
      });
      
      const scanResult = await apiRequest(
        "POST", 
        `/api/scan-qr`, 
        {
          uuid
        }
      );
      
      const result = await scanResult.json();
      
      if (!result.success) {
        const errorCode = result.error_code ? ` (${result.error_code})` : '';
        
        // Translate common server error responses to Arabic
        let arabicErrorMessage = result.message;
        let arabicErrorDetails = '';
        
        // Translate server response details to Arabic
        if (result.details) {
          if (typeof result.details === 'string') {
            // Handle string details
            arabicErrorDetails = translateErrorDetails(result.details);
          } else if (result.details.duplicate) {
            // Handle duplicate scanning case
            arabicErrorDetails = "تم مسح هذا الرمز مسبقاً";
          } else if (result.details.message) {
            // Handle object with message
            arabicErrorDetails = translateErrorDetails(result.details.message);
          } else {
            // Handle other object details by stringifying but translating known patterns
            const detailsStr = JSON.stringify(result.details, null, 2);
            arabicErrorDetails = translateErrorDetails(detailsStr);
          }
        }
        
        // Map common English error messages to Arabic
        if (result.message.includes("already scanned") || result.message.includes("duplicate")) {
          arabicErrorMessage = "تم مسح هذا المنتج مسبقاً";
        } 
        else if (result.message.includes("not found") || result.message.includes("invalid")) {
          arabicErrorMessage = "منتج غير صالح أو غير موجود";
        }
        else if (result.message.includes("expired")) {
          arabicErrorMessage = "انتهت صلاحية رمز المنتج";
        }
        else if (result.message.includes("limit exceeded")) {
          arabicErrorMessage = "تم تجاوز الحد المسموح من المسح";
        }
        else if (result.message.includes("unauthorized") || result.message.includes("permission")) {
          arabicErrorMessage = "غير مصرح لك بمسح هذا المنتج";
        }
        
        // Format the complete error message with any translated details
        let completeErrorMessage = `${arabicErrorMessage}${errorCode}`;
        if (arabicErrorDetails) {
          completeErrorMessage += `\n\nتفاصيل: ${arabicErrorDetails}`;
        }
        
        setError(completeErrorMessage);
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]); // Error vibration pattern
        
        // Auto-dismiss error after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
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
      
      // Set points awarded if available in the response
      if (result.pointsAwarded) {
        setPointsAwarded(result.pointsAwarded);
      } else {
        // Default points when not provided by API
        setPointsAwarded(50);
      }
      
      // Trigger success haptic feedback - one long vibration
      triggerHapticFeedback([200]);
      
      setNotificationType('success');
      setShowNotification(true);
      
      // Hide notification after a few seconds
      setTimeout(() => {
        setShowNotification(false);
        // Reset points after animation completes
        setPointsAwarded(0);
      }, 3500);
      
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
      
      // Ensure error message is in Arabic
      let arabicErrorMessage = "خطأ في التحقق من رمز QR. يرجى المحاولة مرة أخرى.";
      
      // Add error code
      arabicErrorMessage += " (رمز الخطأ: VALIDATION_ERROR)";
      
      // Add translated error details if available
      if (err.message) {
        const translatedDetail = translateErrorDetails(err.message);
        arabicErrorMessage += `\n\nتفاصيل: ${translatedDetail}`;
      } else {
        arabicErrorMessage += "\n\nتفاصيل: خطأ غير معروف";
      }
      
      setError(arabicErrorMessage);
      setIsValidating(false);
      setNotificationType('error');
      setShowNotification(true);
      triggerHapticFeedback([100, 50, 100]); // Error vibration pattern
      
      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      resetScannerAfterDelay(3000);
    }
  };
  
  // Process 6-character alphanumeric codes detected in OCR mode
  const processOcrCode = async (code: string) => {
    console.log("[OCR_DEBUG] Processing OCR-detected code:", code);
    console.log("[OCR_DEBUG] Code length:", code.length);
    console.log("[OCR_DEBUG] Code character check:", code.split('').map(c => ({char: c, isAlphaNumeric: /[A-Z0-9]/i.test(c)})));
    setIsValidating(true);
    setError(null);
    setResult("جارٍ التحقق من الرمز المطبوع...");
    
    try {
      // Validate the code format (6 alphanumeric characters)
      const isValidFormat = /^[A-Z0-9]{6}$/i.test(code);
      console.log("[OCR_DEBUG] Is valid 6-char alphanumeric format:", isValidFormat);
      if (!isValidFormat) {
        console.error("[OCR_DEBUG] Invalid OCR code format:", code);
        setError("الرمز المطبوع غير صالح! يجب أن يتكون من 6 أحرف وأرقام");
        setResult(null);
        setNotificationType('error');
        setShowNotification(true);
        
        // Trigger error haptic feedback
        triggerHapticFeedback([100, 50, 100]);
        
        resetScannerAfterDelay(2000);
        return;
      }
      
      // For now, just treat OCR codes as successful without API verification
      console.log("[OCR_DEBUG] Valid OCR code detected:", code);
      setResult(`تم التحقق من الرمز المطبوع: ${code}`);
      setIsValidating(false);
      setNotificationType('success');
      setShowNotification(true);
      
      // Trigger success haptic feedback
      triggerHapticFeedback([200]);
      
      // Set default points for OCR scans
      setPointsAwarded(50);
      
      // Show success toast
      toast({
        title: "تم التحقق من الرمز المطبوع ✓",
        description: `الرمز: ${code}\nالنقاط المكتسبة: 50`,
        variant: "default",
      });
      
      // Reset scanner after showing success
      resetScannerAfterDelay(2000);
      
    } catch (err: any) {
      console.error("[OCR_DEBUG] Error processing OCR code:", err);
      
      setError("خطأ في التحقق من الرمز المطبوع. يرجى المحاولة مرة أخرى.");
      setIsValidating(false);
      setNotificationType('error');
      setShowNotification(true);
      
      // Trigger error haptic feedback
      triggerHapticFeedback([100, 50, 100]);
      
      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      resetScannerAfterDelay(3000);
    }
  };

  // Switch between scanner modes (QR or OCR)
  const switchScannerMode = useCallback((mode: 'qr' | 'ocr') => {
    // Clear any existing mode switch timer
    if (modeTimerRef.current) {
      clearTimeout(modeTimerRef.current);
      modeTimerRef.current = null;
    }
    
    // Skip if already in this mode
    if (mode === scannerMode) {
      console.log(`[SCANNER_MODE] Already in ${mode} mode, no change needed`);
      return;
    }
    
    console.log(`[SCANNER_MODE] Switching from ${scannerMode} to ${mode} mode`);
    setScannerMode(mode);
    
    // Update status message based on mode
    if (mode === 'qr') {
      setStatusMessage("جارٍ البحث عن رمز QR...");
    } else {
      setStatusMessage("جارٍ البحث عن رمز مطبوع (6 أحرف)...");
    }
    
    // If auto-switching is enabled, set a timer to switch back to the other mode after 10 seconds
    if (autoSwitchEnabled) {
      if (mode === 'qr') {
        console.log("[SCANNER_MODE] Setting 10s timer to auto-switch to OCR mode");
        modeTimerRef.current = setTimeout(() => switchScannerMode('ocr'), 10000);
      } else {
        console.log("[SCANNER_MODE] Setting 10s timer to auto-switch to QR mode");
        modeTimerRef.current = setTimeout(() => switchScannerMode('qr'), 10000);
      }
    }
    
    triggerHapticFeedback([50]);
  }, [scannerMode, autoSwitchEnabled, triggerHapticFeedback]);
  
  // Toggle auto-switching feature
  const toggleAutoSwitch = useCallback(() => {
    const newValue = !autoSwitchEnabled;
    console.log(`[SCANNER_CONFIG] Auto-switch ${newValue ? 'enabled' : 'disabled'}`);
    setAutoSwitchEnabled(newValue);
  }, [autoSwitchEnabled]);
  
  // Manual mode switch function
  const manualSwitchMode = useCallback(() => {
    console.log(`[SCANNER_MODE] Manual switch requested from ${scannerMode} to ${scannerMode === 'qr' ? 'ocr' : 'qr'}`);
    // Switch to the opposite mode
    switchScannerMode(scannerMode === 'qr' ? 'ocr' : 'qr');
  }, [scannerMode, switchScannerMode]);

  // Reset the scanner after processing a result
  const resetScannerAfterDelay = useCallback((delay = 1500) => {
    setTimeout(() => {
      try {
        // Re-enable the current capture mode based on scannerMode
        if (scannerMode === 'qr' && barcodeCaptureRef.current) {
          console.log("Re-enabling QR scanner after validation");
          barcodeCaptureRef.current.setEnabled(true).catch(console.error);
          
          // Disable OCR scanner to avoid conflicts
          if (labelCaptureRef.current) {
            labelCaptureRef.current.setEnabled(false).catch(console.error);
          }
          
          // Restart the auto-switch timer if needed
          if (autoSwitchEnabled && !modeTimerRef.current) {
            modeTimerRef.current = setTimeout(() => {
              switchScannerMode('ocr');
            }, 10000);
          }
        } else if (scannerMode === 'ocr' && labelCaptureRef.current) {
          console.log("Re-enabling OCR scanner after validation");
          labelCaptureRef.current.setEnabled(true).catch(console.error);
          
          // Disable QR scanner to avoid conflicts
          if (barcodeCaptureRef.current) {
            barcodeCaptureRef.current.setEnabled(false).catch(console.error);
          }
          
          // Restart the auto-switch timer if needed
          if (autoSwitchEnabled && !modeTimerRef.current) {
            modeTimerRef.current = setTimeout(() => {
              switchScannerMode('qr');
            }, 10000);
          }
        }
      } catch (err) {
        console.error("Error re-enabling scanner:", err);
      }
    }, delay);
  }, [scannerMode, autoSwitchEnabled, switchScannerMode]);

  // Initialize auto-mode switching when component mounts
  useEffect(() => {
    // Start the auto-switch timer if enabled when component mounts
    if (autoSwitchEnabled && !modeTimerRef.current) {
      modeTimerRef.current = setTimeout(() => {
        console.log("Auto-switching to OCR mode after 10s without QR detection");
        switchScannerMode('ocr');
      }, 10000);
    }
    
    // Clean up timer on unmount
    return () => {
      if (modeTimerRef.current) {
        clearTimeout(modeTimerRef.current);
        modeTimerRef.current = null;
      }
    };
  }, [autoSwitchEnabled, switchScannerMode]);

  // Effect to set up the scanner SDK when the component mounts
  useEffect(() => {
    document.title = "مسح متقدم | برنامج مكافآت بريق";

    let dispose: (() => Promise<void>) | undefined;

    (async () => {
      try {
        // Dynamically import the SDK packages loaded via the CDN import-map
        // @ts-ignore - CDN import-map defines these modules
        const core = await import("@scandit/web-datacapture-core");
        // @ts-ignore
        const barcode = await import("@scandit/web-datacapture-barcode");
        // @ts-ignore
        const label = await import("@scandit/web-datacapture-label");
        
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
        
        const {
          LabelCapture,
          labelCaptureLoader,
          LabelCaptureSettings,
          LabelDefinition
        } = label;

        try {
          // Initialize the Scandit SDK
          console.log("[SCANDIT_SDK] Initializing with license key");
          
          // Create custom logger for Scandit SDK
          const customLogger = {
            debug: (message: string) => console.log(`[SCANDIT_SDK] DEBUG: ${message}`),
            info: (message: string) => console.log(`[SCANDIT_SDK] INFO: ${message}`),
            warn: (message: string) => console.warn(`[SCANDIT_SDK] WARN: ${message}`),
            error: (message: string) => console.error(`[SCANDIT_SDK] ERROR: ${message}`)
          };
          
          await configure({
            licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || "",
            libraryLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7.2.1/sdc-lib/",
            moduleLoaders: [barcodeCaptureLoader(), labelCaptureLoader()],
            preloadEngine: true,
            engineLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7.2.1/build",
            logger: customLogger
          });
        } catch (configError) {
          console.error("Configuration error:", configError);
          setError("فشل تهيئة الماسح الضوئي. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.");
          setLicenseStatus('failed');
          return;
        }
        
        // SDK initialized successfully
        setLicenseStatus('initialized');

        // Create the DataCaptureContext
        const context = await DataCaptureContext.create();
        contextRef.current = context;
        
        // Create the DataCaptureView and connect it to the scanner element
        const view = new DataCaptureView();
        await view.setContext(context);
        
        if (scannerRef.current) {
          view.connectToElement(scannerRef.current);
        } else {
          console.error("Scanner element reference is null");
          setError("فشل في الاتصال بعنصر المسح الضوئي. يرجى تحديث الصفحة.");
          setLicenseStatus('failed');
          return;
        }
        
        // Add torch (flashlight) control
        const torchSwitch = new TorchSwitchControl();
        await view.addControl(torchSwitch);

        // Set up the camera
        const camera = Camera.default;
        if (!camera) {
          setError("لم يتم العثور على كاميرا. يرجى التأكد من إتاحة الوصول إلى الكاميرا.");
          setLicenseStatus('failed');
          return;
        }
        
        try {
          await context.setFrameSource(camera);
        } catch (cameraError) {
          console.error("Camera error:", cameraError);
          setError("فشل الاتصال بالكاميرا. يرجى التأكد من السماح بالوصول إلى الكاميرا من إعدادات المتصفح.");
          setLicenseStatus('failed');
          return;
        }
        
        // Optimize camera settings
        const cameraSettings = new CameraSettings();
        cameraSettings.preferredResolution = VideoResolution.Auto;
        cameraSettings.zoomFactor = 1.3; // Slightly zoomed in for better small code reading
        await camera.applySettings(cameraSettings);
        
        try {
          await camera.switchToDesiredState(FrameSourceState.On);
        } catch (cameraStateError) {
          console.error("Camera state error:", cameraStateError);
          setError("فشل تشغيل الكاميرا. يرجى التأكد من عدم استخدام كاميرا من قبل تطبيق آخر.");
          setLicenseStatus('failed');
          return;
        }

        // Configure barcode capture for QR scanning
        const barcodeCaptureSettings = new BarcodeCaptureSettings();
        barcodeCaptureSettings.enableSymbologies([Symbology.QR]);
        
        // Enable inverted color QR codes
        const qrSettings = barcodeCaptureSettings.settingsForSymbology(Symbology.QR);
        qrSettings.isColorInvertedEnabled = true;
        
        // Define a rectangular scan area
        const width = new NumberWithUnit(0.8, MeasureUnit.Fraction);
        const heightToWidth = 1; // Square finder
        const locationSelection = RectangularLocationSelection.withWidthAndAspectRatio(
          width, heightToWidth
        );
        barcodeCaptureSettings.locationSelection = locationSelection;
        
        // Create the barcode capture instance
        const barcodeCapture = await BarcodeCapture.forContext(context, barcodeCaptureSettings);
        barcodeCaptureRef.current = barcodeCapture;
        
        // Set up barcode capture listener
        barcodeCapture.addListener({
          didScan: async (_mode: any, session: any) => {
            // Check if we're in QR mode - if not, ignore results
            if (scannerMode !== 'qr') return;
            
            const code = session.newlyRecognizedBarcodes[0];
            if (!code) return;
            
            // Get the data from the barcode
            const data = code.data || '';
            console.log("QR code detected:", data);
            
            // If it's a valid URL, temporarily disable capture and validate
            if (data && typeof data === 'string' && data.startsWith('http')) {
              await barcodeCapture.setEnabled(false);
              await validateQrCode(data);
            }
          }
        });
        
        // Configure label capture for OCR mode
        const labelCaptureSettings = new LabelCaptureSettings();
        
        // Create a label definition for 6-character alphanumeric codes
        const alphanumericPattern = "[A-Z0-9]{6}";
        const labelDefinition = new LabelDefinition();
        labelDefinition.setPattern(alphanumericPattern);
        labelCaptureSettings.addLabelDefinition(labelDefinition);
        
        // Create the label capture instance
        const labelCapture = await LabelCapture.forContext(context, labelCaptureSettings);
        labelCaptureRef.current = labelCapture;
        
        // Set up label capture listener
        labelCapture.addListener({
          didCaptureLabels: async (_mode: any, session: any) => {
            // Check if we're in OCR mode - if not, ignore results
            if (scannerMode !== 'ocr') return;
            
            const labels = session.newlyCapturedLabels;
            if (!labels || labels.length === 0) return;
            
            // Get the text from the first label
            const label = labels[0];
            const text = label.value || '';
            console.log("OCR label detected:", text);
            
            // If it matches our pattern, process it
            if (text && typeof text === 'string' && /^[A-Z0-9]{6}$/i.test(text)) {
              await labelCapture.setEnabled(false);
              await processOcrCode(text);
            }
          }
        });
        
        // Start with QR mode by default
        await labelCapture.setEnabled(false);
        await barcodeCapture.setEnabled(true);

        // Provide a disposer to clean up when component unmounts
        dispose = async () => {
          try {
            if (barcodeCapture) {
              await barcodeCapture.setEnabled(false);
            }
            if (labelCapture) {
              await labelCapture.setEnabled(false);
            }
            if (context) {
              await context.dispose();
            }
          } catch (disposeError) {
            console.error("Error during cleanup:", disposeError);
          }
        };
        
      } catch (error) {
        console.error("Scanner initialization error:", error);
        setError("حدث خطأ أثناء تهيئة الماسح الضوئي. يرجى تحديث الصفحة والمحاولة مرة أخرى.");
        setLicenseStatus('failed');
      }
    })();

    // Clean up function
    return () => {
      // Clear any timers
      if (modeTimerRef.current) {
        clearTimeout(modeTimerRef.current);
        modeTimerRef.current = null;
      }
      
      // Dispose of SDK resources
      if (dispose) {
        dispose().catch(console.error);
      }
    };
  }, [validateQrCode, processOcrCode, scannerMode, resetScannerAfterDelay]);
  
  // Effect to handle scanner mode changes
  useEffect(() => {
    // When scanner mode changes, enable the appropriate scanner and disable the other
    (async () => {
      try {
        if (scannerMode === 'qr') {
          // Switch to QR mode
          if (labelCaptureRef.current) {
            await labelCaptureRef.current.setEnabled(false);
          }
          if (barcodeCaptureRef.current) {
            await barcodeCaptureRef.current.setEnabled(true);
          }
          console.log("[SCANNER_MODE] QR mode activated");
        } else {
          // Switch to OCR mode
          if (barcodeCaptureRef.current) {
            await barcodeCaptureRef.current.setEnabled(false);
          }
          if (labelCaptureRef.current) {
            await labelCaptureRef.current.setEnabled(true);
          }
          console.log("[SCANNER_MODE] OCR mode activated");
        }
      } catch (err) {
        console.error("Error switching scanner mode:", err);
      }
    })();
  }, [scannerMode]);

  return (
    <InstallerLayout>
      <div className="flex flex-col items-center justify-start w-full h-full overflow-hidden">
        {/* Scanner area */}
        <div className="relative w-full h-[70vh] bg-black rounded-lg overflow-hidden">
          {/* Scanner view */}
          <div 
            ref={scannerRef} 
            className="absolute inset-0 w-full h-full"
          />
          
          {/* Overlay with status message */}
          <div className="absolute bottom-0 right-0 p-4 bg-black/50 text-white rounded-tl-lg">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              {scannerMode === 'qr' ? <QrCode size={18} /> : <TextCursorInput size={18} />}
              <span>{statusMessage}</span>
            </div>
          </div>
          
          {/* Loading overlay */}
          {licenseStatus === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
              <p className="text-white text-center">جارٍ تهيئة الماسح الضوئي...</p>
            </div>
          )}
          
          {/* License failure overlay */}
          {licenseStatus === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 p-4">
              <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
              <p className="text-white text-center text-lg font-bold mb-2">فشل تهيئة الماسح الضوئي</p>
              <p className="text-white/80 text-center">{error || "حدث خطأ أثناء تحميل مكتبة المسح الضوئي. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى."}</p>
            </div>
          )}
          
          {/* Processing overlay */}
          {isValidating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
              <p className="text-white text-center">جارٍ التحقق من الرمز...</p>
            </div>
          )}
          
          {/* Success/Error notification */}
          {showNotification && (
            <div className={`absolute inset-x-0 top-5 mx-auto max-w-[85%] p-4 rounded-lg shadow-lg z-20 text-center ${
              notificationType === 'success' ? 'bg-green-800 text-white' : 'bg-red-800 text-white'
            }`}>
              <div className="flex items-center justify-center mb-1">
                {notificationType === 'success' ? (
                  <CheckCircle2 className="h-6 w-6 mr-2" />
                ) : (
                  <AlertCircle className="h-6 w-6 mr-2" />
                )}
                <p className="font-semibold">{notificationType === 'success' ? result : "خطأ"}</p>
              </div>
              
              {/* Points animation for success */}
              {notificationType === 'success' && pointsAwarded > 0 && (
                <div className="mt-2 font-bold text-lg">
                  +{pointsAwarded} نقطة
                </div>
              )}
              
              {/* Error details */}
              {notificationType === 'error' && error && (
                <p className="text-sm mt-1">{error}</p>
              )}
            </div>
          )}
        </div>
        
        {/* Scanner controls */}
        <div className="w-full p-4 space-y-3">
          {/* Scanner mode toggle */}
          <div className="flex items-center justify-center space-x-3 rtl:space-x-reverse">
            <Button
              type="button"
              onClick={manualSwitchMode}
              variant="outline"
              className="flex-1"
            >
              {scannerMode === 'qr' ? (
                <>
                  <TextCursorInput className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  تبديل إلى وضع النص
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  تبديل إلى وضع QR
                </>
              )}
            </Button>
            
            {/* Auto-switch toggle */}
            <Button
              type="button"
              onClick={toggleAutoSwitch}
              variant={autoSwitchEnabled ? "default" : "secondary"}
              size="sm"
              className="min-w-[44px] px-3"
            >
              {autoSwitchEnabled ? "تلقائي ✓" : "يدوي"}
            </Button>
          </div>
          
          {/* Info text */}
          <div className="flex items-start text-center p-3 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 ltr:mr-2 rtl:ml-2 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {scannerMode === 'qr' ? 
                "صوّب الكاميرا على رمز QR من بريق. سيتم التبديل تلقائياً إلى وضع النص إذا لم يتم العثور على رمز QR خلال 10 ثوانٍ." :
                "صوّب الكاميرا على الرمز المطبوع المكون من 6 أحرف وأرقام. سيتم التبديل تلقائياً إلى وضع QR بعد 10 ثوانٍ."
              }
            </p>
          </div>
        </div>
      </div>
    </InstallerLayout>
  );
}