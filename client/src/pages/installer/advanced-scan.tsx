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
 * Advanced scanner page – powered by Scandit Web SDK
 * Note: Scandit modules are pulled dynamically via CDN import-map (see index.html).
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
  const captureRef = useRef<any>(null); // Reference for barcode capture
  const textCaptureRef = useRef<any>(null); // Reference for text capture
  
  // Timers for auto-switching between modes
  const modeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State for scan result notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | null>(null);
  
  // Helper function for haptic feedback
  const triggerHapticFeedback = (pattern: number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.error('Haptic feedback failed:', e);
      }
    }
  };

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

      // Step 3: Send to server for validation and processing - using secure session for user identification
      // No need to manually include userId as it will be derived from session on the server
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
      
      // Update all error messages in DOM to ensure Arabic
      setTimeout(() => {
        // Find and translate any error messages that might be injected by the SDK
        const translateErrorElements = () => {
          try {
            // Find common error message selectors that might be added by Scandit
            const errorElements = document.querySelectorAll('.error-message, .scandit-error, [data-error]');
            errorElements.forEach(el => {
              const text = el.textContent || '';
              if (text && text.trim() && text.length > 0) {
                // Basic English to Arabic translations for common Scandit errors
                if (text.includes('camera') || text.includes('Camera')) {
                  el.textContent = 'خطأ في الوصول إلى الكاميرا. يرجى التحقق من الأذونات.';
                } else if (text.includes('permission')) {
                  el.textContent = 'تم رفض إذن الكاميرا. يرجى السماح بالوصول.';
                } else if (text.includes('license')) {
                  el.textContent = 'خطأ في التحقق من الترخيص.';
                } else if (text.includes('network') || text.includes('connection')) {
                  el.textContent = 'خطأ في الاتصال بالشبكة.';
                } else {
                  // Generic translation for other errors
                  el.textContent = 'حدث خطأ. يرجى تحديث الصفحة.';
                }
                // Set RTL direction
                el.setAttribute('dir', 'rtl');
              }
            });
          } catch (e) {
            console.warn('Error while translating error elements:', e);
          }
        };
        
        // Run initially and set interval to catch dynamically added errors
        translateErrorElements();
        const intervalId = setInterval(translateErrorElements, 1000);
        
        // Clear interval after 10 seconds
        setTimeout(() => clearInterval(intervalId), 10000);
      }, 500);
      
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

  // Function to switch between scanner modes
  const switchScannerMode = useCallback((mode: 'qr' | 'ocr') => {
    try {
      // Clear any existing auto-switch timer
      if (modeTimerRef.current) {
        clearTimeout(modeTimerRef.current);
        modeTimerRef.current = null;
      }
      
      // Set new mode and update status message
      setScannerMode(mode);
      
      if (mode === 'qr') {
        setStatusMessage("جارٍ البحث عن رمز QR...");
        
        // Disable text capture and enable barcode capture
        if (textCaptureRef.current) {
          textCaptureRef.current.setEnabled(false).catch(console.error);
        }
        if (captureRef.current) {
          captureRef.current.setEnabled(true).catch(console.error);
        }
        
        // Set timer to auto-switch to OCR mode if enabled
        if (autoSwitchEnabled) {
          modeTimerRef.current = setTimeout(() => {
            console.log("Auto-switching to OCR mode after 10s without QR detection");
            switchScannerMode('ocr');
          }, 10000);
        }
      } else {
        setStatusMessage("جارٍ البحث عن الرمز المطبوع...");
        
        // Disable barcode capture and enable text capture
        if (captureRef.current) {
          captureRef.current.setEnabled(false).catch(console.error);
        }
        if (textCaptureRef.current) {
          textCaptureRef.current.setEnabled(true).catch(console.error);
        }
        
        // Set timer to auto-switch back to QR mode if enabled
        if (autoSwitchEnabled) {
          modeTimerRef.current = setTimeout(() => {
            console.log("Auto-switching to QR mode after 10s without OCR detection");
            switchScannerMode('qr');
          }, 10000);
        }
      }
      
      // Trigger haptic feedback for mode change
      triggerHapticFeedback([50]);
    } catch (err) {
      console.error("Error switching scanner mode:", err);
    }
  }, [autoSwitchEnabled]);
  
  // Toggle auto-switching feature
  const toggleAutoSwitch = () => {
    setAutoSwitchEnabled(!autoSwitchEnabled);
  };

  // Reset the scanner after processing a result
  const resetScannerAfterDelay = (delay = 1500) => {
    setTimeout(() => {
      try {
        // Re-enable the current capture mode after processing
        if (scannerMode === 'qr' && captureRef.current) {
          console.log("Re-enabling QR scanner after validation");
          captureRef.current.setEnabled(true).catch(console.error);
          // Restart the auto-switch timer
          if (autoSwitchEnabled && !modeTimerRef.current) {
            modeTimerRef.current = setTimeout(() => {
              switchScannerMode('ocr');
            }, 10000);
          }
        } else if (scannerMode === 'ocr' && textCaptureRef.current) {
          console.log("Re-enabling OCR scanner after validation");
          textCaptureRef.current.setEnabled(true).catch(console.error);
          // Restart the auto-switch timer
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
  };

  // Process a detected 6-character alphanumeric code from OCR scanning
  const processOcrCode = useCallback((detectedCode: string) => {
    // Only process if it matches our pattern (6 alphanumeric chars)
    if (/^[A-Z0-9]{6}$/.test(detectedCode)) {
      console.log("OCR detected a valid 6-character code:", detectedCode);
      
      // Show success message
      setResult(`تم اكتشاف الرمز المطبوع: ${detectedCode}`);
      setNotificationType('success');
      setShowNotification(true);
      triggerHapticFeedback([200]); // Success vibration
      
      // Set points awarded
      setPointsAwarded(50);
      
      // Show toast
      toast({
        title: "تم التحقق من الرمز المطبوع ✓",
        description: `الرمز: ${detectedCode}\nالنقاط المكتسبة: 50`,
        variant: "default",
      });
      
      // Reset scanner after showing success
      resetScannerAfterDelay(2000);
      
      // Clear the OCR auto-switch timer
      if (modeTimerRef.current) {
        clearTimeout(modeTimerRef.current);
        modeTimerRef.current = null;
      }
      
      return true;
    }
    return false;
  }, [toast, triggerHapticFeedback, resetScannerAfterDelay]);
  
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
  
  useEffect(() => {
    document.title = "مسح متقدم | برنامج مكافآت بريق";

    let dispose: (() => Promise<void>) | undefined;

    (async () => {
      try {
        /* Dynamically import the SDK packages loaded via the CDN */
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const core = await import("@scandit/web-datacapture-core");
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const barcode = await import("@scandit/web-datacapture-barcode");
        
        // We're not using text capture module for now, but will use enhanced barcode settings
        // to handle OCR-like scanning of alphanumeric codes
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
        } = core as any;

        const {
          BarcodeCapture,
          barcodeCaptureLoader,
          BarcodeCaptureSettings,
          Symbology,
          SymbologyDescription
        } = barcode as any;

        try {
          /* Initialise the engine (downloads WASM files automatically) */
          console.log("Using license key from environment secret");
          await configure({
            licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || "",
            libraryLocation:
              "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/sdc-lib/",
            moduleLoaders: [barcodeCaptureLoader()],
            // Fix for runtime error by patching errorElement
            preloadEngine: true,
            engineLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/build",
            // Intercept and translate SDK error messages to Arabic
            errorListener: {
              onError: (error: any) => {
                // Translate Scandit error messages to Arabic
                console.error("Scandit error:", error);
                let arabicMessage = "خطأ في تهيئة الماسح الضوئي";

                if (error && error.message) {
                  if (error.message.includes("license")) {
                    arabicMessage = "خطأ في ترخيص المكتبة، يرجى التحقق من صلاحية الترخيص";
                  } else if (error.message.includes("camera") || error.message.includes("permission")) {
                    arabicMessage = "تعذر الوصول إلى الكاميرا، يرجى التحقق من الأذونات";
                  } else if (error.message.includes("network") || error.message.includes("download")) {
                    arabicMessage = "خطأ في الاتصال بالشبكة، يرجى التحقق من اتصالك بالإنترنت";
                  }
                }

                setError(arabicMessage);
                setLicenseStatus('failed');
                setNotificationType('error');
                setShowNotification(true);

                // Do not return the message to the SDK, to prevent it from trying to display it.
                // This might prevent the 'this.errorElement.textContent' error.
                return; 
              }
            }
          });
        } catch (configError) {
          console.error("Configuration error:", configError);
          setError("فشل تهيئة الماسح الضوئي. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.");
          setLicenseStatus('failed');
          return;
        }
        
        // Update license status
        setLicenseStatus('initialized');

        // Create a patched version of scanner to intercept SDK errors
        const createProtectedElement = (operation: Function) => {
          try {
            return operation();
          } catch (err) {
            console.warn("Protected element operation failed:", err);
            
            // Translate any English error to Arabic
            let arabicError = "خطأ أثناء تهيئة الماسح الضوئي";
            if (err && typeof err === 'object') {
              const errMsg = err.toString();
              if (errMsg.includes("camera") || errMsg.includes("Camera")) {
                arabicError = "تعذر الوصول إلى الكاميرا. يرجى التأكد من السماح بالوصول.";
              } else if (errMsg.includes("permission")) {
                arabicError = "تم رفض أذونات الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.";
              }
            }
            
            // Show Arabic error
            setError(arabicError);
            setNotificationType('error');
            setShowNotification(true);
            
            return null;
          }
        };

        /* Set up capture context & view */
        const context = await createProtectedElement(() => DataCaptureContext.create());
        if (!context) {
          setError("فشل إنشاء سياق المسح الضوئي. يرجى تحديث الصفحة والمحاولة مرة أخرى.");
          setLicenseStatus('failed');
          return;
        }
        
        contextRef.current = context; // Store context in ref
        
        const view = new DataCaptureView();
        await view.setContext(context);
        
        // Make sure scannerRef.current exists before connecting
        if (scannerRef.current) {
          view.connectToElement(scannerRef.current);
        } else {
          console.error("Scanner element reference is null");
          setError("فشل في الاتصال بعنصر المسح الضوئي. يرجى تحديث الصفحة.");
          setLicenseStatus('failed');
          return;
        }
        
        // 🔦 Torch toggle button (auto-hides if torch not available)
        const torchSwitch = new TorchSwitchControl();
        await view.addControl(torchSwitch);

        /* Camera with optimized settings */
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
        
        // Optimization 3: Camera Settings
        const cameraSettings = new CameraSettings();
        cameraSettings.preferredResolution = VideoResolution.Auto; // Let device choose optimal resolution
        cameraSettings.zoomFactor = 1.3; // Helpful for small QR codes
        await camera.applySettings(cameraSettings);
        
        try {
          await camera.switchToDesiredState(FrameSourceState.On);
        } catch (cameraStateError) {
          console.error("Camera state error:", cameraStateError);
          setError("فشل تشغيل الكاميرا. يرجى التأكد من عدم استخدام كاميرا من قبل تطبيق آخر.");
          setLicenseStatus('failed');
          return;
        }

        /* Capture only QR codes with optimized settings */
        // Create settings that will be swapped based on scan mode
        const qrModeSettings = new BarcodeCaptureSettings();
        qrModeSettings.enableSymbologies([Symbology.QR]);
        
        // Enable inverted color scanning for QR mode
        const qrSettings = qrModeSettings.settingsForSymbology(Symbology.QR);
        qrSettings.isColorInvertedEnabled = true;
        
        // Create separate settings optimized for alphanumeric text codes
        const ocrModeSettings = new BarcodeCaptureSettings();
        // Enable symbologies that can detect alphanumeric codes
        ocrModeSettings.enableSymbologies([
          Symbology.Code128, 
          Symbology.Code39, 
          Symbology.DataMatrix
        ]);
        
        // Configure code symbologies to better detect short alphanumeric sequences
        try {
          const code128Settings = ocrModeSettings.settingsForSymbology(Symbology.Code128);
          code128Settings.isColorInvertedEnabled = true;
          
          const code39Settings = ocrModeSettings.settingsForSymbology(Symbology.Code39);
          code39Settings.isColorInvertedEnabled = true;
          
          const dataMatrixSettings = ocrModeSettings.settingsForSymbology(Symbology.DataMatrix);
          dataMatrixSettings.isColorInvertedEnabled = true;
        } catch (e) {
          console.warn("Could not configure text mode settings:", e);
        }
        
        // Start with QR settings by default
        const settings = scannerMode === 'qr' ? qrModeSettings : ocrModeSettings;
        
        // Log current scanner mode and settings
        console.log(`Scanner mode: ${scannerMode}`, {
          symbologies: scannerMode === 'qr' ? 'QR only' : 'Code128, Code39, DataMatrix',
          colorInverted: true
        });
        
        // Optimization 1: Rectangular location selection (focused scan area)
        const width = new NumberWithUnit(0.8, MeasureUnit.Fraction); // 80% of the view
        const heightToWidth = 1; // Square finder
        const locationSelection = RectangularLocationSelection.withWidthAndAspectRatio(
          width, heightToWidth
        );
        settings.locationSelection = locationSelection;
        
        // Optimization 2: Smart scan intention to reduce duplicate scans
        // Fix for the ScanIntention error - use a safe approach with try/catch
        try {
          // Try to set scan intention if available
          if (typeof barcode.ScanIntention === 'object' && barcode.ScanIntention?.Smart) {
            settings.scanIntention = barcode.ScanIntention.Smart;
          } else if (typeof core.ScanIntention === 'object' && core.ScanIntention?.Smart) {
            settings.scanIntention = core.ScanIntention.Smart;
          } else if (typeof settings.setProperty === 'function') {
            // Fallback to using setProperty if available
            settings.setProperty("barcodeCapture.scanIntention", "smart");
          } else {
            console.log("ScanIntention not available in API, skipping this optimization");
          }
        } catch (settingsError) {
          console.warn("Error setting scan intention:", settingsError);
        }
        
        // Set codeDuplicateFilter to 500ms for more responsive scanning
        settings.setProperty("barcodeCapture.codeDuplicateFilter", 500);

        const capture = await BarcodeCapture.forContext(context, settings);
        captureRef.current = capture; // Store capture in ref
        
        capture.addListener({
          didScan: async (_mode: any, session: any) => {
            const code = session.newlyRecognizedBarcode;
            if (!code) return;
            
            // Disable capture while processing
            await capture.setEnabled(false);
            
            // Get barcode data and type
            const data = code.data;
            const symbology = code.symbology;
            
            console.log(`Barcode detected in ${scannerMode} mode:`, { data, symbology });
            
            if (scannerMode === 'qr') {
              // In QR mode, process as QR code
              await validateQrCode(data);
            } else {
              // In OCR mode, try to extract a 6-character alphanumeric code
              try {
                // Check if the data contains a 6-character alphanumeric pattern
                // This could come directly from the barcode or be part of a larger string
                const codeMatch = data.match(/[A-Z0-9]{6}/i);
                
                if (codeMatch) {
                  // Found a 6-character code pattern
                  const detectedCode = codeMatch[0].toUpperCase();
                  console.log("OCR successfully detected a 6-character code:", detectedCode);
                  
                  // Process the detected code with our custom function
                  await processOcrCode(detectedCode);
                } else {
                  // Data doesn't contain a valid 6-character code
                  console.log("Detected barcode doesn't contain a valid 6-character code:", data);
                  // Re-enable scanner after a short delay
                  setTimeout(() => {
                    if (captureRef.current) {
                      captureRef.current.setEnabled(true).catch(console.error);
                    }
                  }, 500);
                }
              } catch (err) {
                console.error("Error processing OCR data:", err);
                // Re-enable scanner after error
                setTimeout(() => {
                  if (captureRef.current) {
                    captureRef.current.setEnabled(true).catch(console.error);
                  }
                }, 500);
              }
            }
          }
        });
        await capture.setEnabled(true);

        /* Provide disposer so we shut everything down on unmount */
        dispose = async () => {
          try {
            if (capture) {
              await capture.setEnabled(false);
            }
            if (context) {
              await context.dispose();
            }
          } catch (disposeError) {
            console.error("Error during disposal:", disposeError);
          }
        };
      } catch (e: any) {
        console.error("Scanner initialization error:", e);
        
        // Ensure scanner setup error message is in Arabic
        let arabicErrorMessage = "فشل إعداد الماسح";
        
        // Add more specific error details in Arabic if available
        if (e?.message) {
          if (e.message.includes("license")) {
            arabicErrorMessage = "فشل التحقق من ترخيص الماسح";
          } else if (e.message.includes("camera")) {
            arabicErrorMessage = "فشل الوصول إلى الكاميرا. يرجى التأكد من السماح بالوصول إلى الكاميرا";
          } else if (e.message.includes("permission")) {
            arabicErrorMessage = "تم رفض إذن الوصول إلى الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح";
          } else if (e.message.includes("textContent")) {
            arabicErrorMessage = "خطأ في تحميل المكتبة. يرجى تحديث الصفحة والمحاولة مرة أخرى";
          } else {
            arabicErrorMessage = `فشل إعداد الماسح: ${e.message}`;
          }
        }
        
        setError(arabicErrorMessage);
        setLicenseStatus('failed');
        
        // Show error notification
        setNotificationType('error');
        setShowNotification(true);
        
        // Auto-dismiss error after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
      }
    })();

    // Override native error dialog with our custom Arabic one
    // Apply a global error handler to catch Scandit SDK error dialogs
    const originalAlert = window.alert;
    window.alert = function(message) {
      console.log("Alert intercepted:", message);
      
      // Translate alert messages to Arabic
      let arabicMessage = "حدث خطأ في المسح الضوئي";
      
      if (typeof message === 'string') {
        if (message.includes("camera") || message.includes("Camera")) {
          arabicMessage = "تعذر الوصول إلى الكاميرا. يرجى التأكد من إتاحة الوصول.";
        } else if (message.includes("permission")) {
          arabicMessage = "تم رفض أذونات الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.";
        } else if (message.includes("license")) { 
          arabicMessage = "خطأ في التحقق من ترخيص المكتبة.";
        } else if (message.includes("network") || message.includes("error")) {
          arabicMessage = "خطأ في الاتصال بالشبكة أو تحميل المكتبة.";
        }
      }
      
      // Show our custom Arabic error notification instead
      setError(arabicMessage);
      setNotificationType('error');
      setShowNotification(true);
      
      // Don't show the original alert
      return;
    };

    // Restore original alert on unmount
    return () => {
      window.alert = originalAlert;
      if (dispose) dispose().catch(console.error);
    };
  }, []);

  return (
    <InstallerLayout activeTab="advanced-scan">
      {/* Responsive grid layout container */}
      <div className="grid h-[calc(100dvh-4.5rem)] grid-rows-[auto_1fr] overflow-hidden">
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
              
              {/* Scanner Mode Indicator */}
              <div className="flex items-center gap-1 mr-2 border-r pr-2 border-gray-300">
                {scannerMode === 'qr' ? (
                  <>
                    <QrCode className="h-4 w-4" />
                    <span className="text-xs">وضع QR</span>
                  </>
                ) : (
                  <>
                    <TextCursorInput className="h-4 w-4" />
                    <span className="text-xs">وضع النص</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Scanner Mode Status Message */}
          {licenseStatus === 'initialized' && (
            <div className="flex justify-center mt-2">
              <div 
                className={`px-4 py-1 rounded-full text-sm ${
                  scannerMode === 'qr' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-amber-500/10 text-amber-700'
                }`}
              >
                <span className="text-xs font-medium">{statusMessage}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Scanner viewport - using grid cell to take all available space */}
        <div className="relative overflow-hidden">
          <div
            ref={scannerRef}
            className="absolute inset-0 bg-black overflow-hidden"
            aria-label="مساحة مسح رمز الاستجابة السريعة"
          />
          
          {/* Scanner overlay - changes based on scanner mode */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              {scannerMode === 'qr' ? (
                /* QR Mode - square guide */
                <div className="relative w-[min(80vw,80vh)] max-w-md aspect-square">
                  {/* QR Scan animation */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-scanline"></div>
                  
                  {/* Visual border for QR scanning */}
                  <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-md"></div>
                  
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary"></div>
                </div>
              ) : (
                /* OCR Mode - rectangle for text scanning */
                <div className="relative w-[min(85vw,400px)] h-24 border-2 border-amber-500 rounded-md flex items-center justify-center bg-black/20">
                  {/* OCR scanning animation - moving line */}
                  <div 
                    className="absolute h-full w-1 bg-gradient-to-b from-transparent via-amber-500 to-transparent" 
                    style={{
                      animation: 'pulse-slide 2s infinite ease-in-out',
                      left: 0
                    }}
                  ></div>
                  
                  {/* OCR guidance text */}
                  <div className="text-amber-500 text-sm font-medium px-4 text-center">
                    <div>وجه الكاميرا نحو الرمز المطبوع</div>
                    <div className="text-xs opacity-70 mt-1">رمز من ٦ أحرف وأرقام</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Scanning instruction message - changes based on mode */}
            <div className="absolute bottom-20 left-0 right-0 flex justify-center">
              <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                {scannerMode === 'qr' 
                  ? 'وجه الكاميرا نحو رمز QR الخاص بالمنتج'
                  : 'وجه الكاميرا نحو الرمز المطبوع بجانب QR'
                }
              </div>
            </div>
            
            {/* Mode toggle buttons - control panel in top right */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <Button
                onClick={() => switchScannerMode(scannerMode === 'qr' ? 'ocr' : 'qr')}
                className={`rounded-full shadow-lg ${scannerMode === 'qr' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90'}`}
                size="sm"
              >
                {scannerMode === 'qr' ? (
                  <span className="flex items-center gap-1 text-white">
                    <TextCursorInput className="h-4 w-4" />
                    <span>تبديل إلى وضع النص</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-white">
                    <QrCode className="h-4 w-4" />
                    <span>تبديل إلى وضع QR</span>
                  </span>
                )}
              </Button>
              
              <Button
                onClick={toggleAutoSwitch}
                className={`rounded-full shadow-lg text-xs flex items-center gap-2 ${
                  autoSwitchEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
                size="sm"
              >
                <div className={`w-2 h-2 rounded-full ${autoSwitchEnabled ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-white">{autoSwitchEnabled ? 'التبديل التلقائي: مفعّل' : 'التبديل التلقائي: معطل'}</span>
              </Button>
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
          
          {/* Unified Notification Overlay for Success and Error - Professional Design */}
          {showNotification && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 animate-fade-in overflow-hidden">
              <div className={`
                w-[85%] max-w-md mx-auto rounded-lg shadow-xl p-6
                ${notificationType === 'success' 
                  ? 'bg-gradient-to-br from-primary/95 to-secondary/95' 
                  : 'bg-gradient-to-br from-red-600/95 to-red-800/95'} 
                backdrop-blur-md animate-scale-in
              `}
              aria-live="polite"
              role="dialog"
              aria-labelledby="notification-title"
              dir="rtl"
              >
                <div className="flex flex-col items-center">
                  {/* Icon container with pulsing animation */}
                  <div className={`
                    h-20 w-20 rounded-full flex items-center justify-center mb-4
                    ${notificationType === 'success' 
                      ? 'bg-white/20' 
                      : 'bg-white/20'}
                    animate-pulse-gentle
                  `}>
                    {notificationType === 'success' ? (
                      <CheckCircle2 className="h-12 w-12 text-white" />
                    ) : (
                      <AlertCircle className="h-12 w-12 text-white" />
                    )}
                  </div>
                  
                  {/* Title */}
                  <h3 
                    className="text-xl font-bold text-white mb-2"
                    id="notification-title"
                  >
                    {notificationType === 'success' 
                      ? 'تم التحقق بنجاح!' 
                      : 'فشل التحقق'}
                  </h3>
                  
                  {/* Content */}
                  <div className="text-center">
                    {notificationType === 'success' ? (
                      <>
                        <p className="text-white/90 mb-3">{result}</p>
                        {/* Points indicator */}
                        {pointsAwarded > 0 && (
                          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-5 py-2 animate-bounce-gentle">
                            <span className="text-yellow-300 font-bold text-lg">+{pointsAwarded}</span>
                            <span className="text-white font-medium">نقطة</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-white/90 text-sm whitespace-pre-wrap" dir="rtl">{error}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Floating Result Panel (used when no full-screen notification) */}
          <div className={`absolute bottom-6 left-4 right-4 transition-all duration-300 ${(!showNotification && (result || error)) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl overflow-hidden">
              <div className={`px-5 py-4 ${result ? 'border-l-4 border-green-500' : error ? 'border-l-4 border-red-500' : ''}`}>
                {result && !showNotification && (
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">تم التحقق من المنتج بنجاح</h3>
                      <p className="text-green-600 font-medium text-sm mt-1">{result}</p>
                    </div>
                  </div>
                )}
                {error && !showNotification && (
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">فشل التحقق</h3>
                      <p className="text-red-600 text-sm mt-1 whitespace-pre-wrap" dir="rtl">{error}</p>
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
          
          {/* Error fallback for scanner initialization failures */}
          {licenseStatus === 'failed' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-6">
              <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
              <h2 className="text-xl font-bold mb-2 text-center">فشل تهيئة الماسح الضوئي</h2>
              <p className="text-center mb-6 max-w-md" dir="rtl">{error || "حدث خطأ غير متوقع. يرجى تحديث الصفحة والمحاولة مرة أخرى."}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-primary hover:bg-primary/90 px-6 py-3 rounded-md font-medium"
              >
                إعادة تحميل الصفحة
              </button>
            </div>
          )}
        </div>
      </div>
    </InstallerLayout>
  );
}