import { useEffect, useRef, useState } from "react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2, CheckCircle2, AlertCircle, Info, ScanText } from "lucide-react";
import InstallerLayout from "@/components/layouts/installer-layout";

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
  
  // Reference to context and capture for later use
  const contextRef = useRef<any>(null);
  const barcodeCaptureRef = useRef<any>(null);
  const idCaptureRef = useRef<any>(null);

  // State for scan result notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | null>(null);
  
  // State for scan mode and OCR attempts
  const [scanMode, setScanMode] = useState<'qr' | 'ocr'>('qr');
  const [ocrAttemptTimer, setOcrAttemptTimer] = useState<NodeJS.Timeout | null>(null);
  const [showOcrFallbackButton, setShowOcrFallbackButton] = useState(false);
  const ocrFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setShowOcrFallbackButton(false);
    if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);

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
        triggerHapticFeedback([100, 50, 100]);
        
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
        triggerHapticFeedback([100, 50, 100]);
        
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
        triggerHapticFeedback([100, 50, 100]);
        
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
        triggerHapticFeedback([100, 50, 100]);
        
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
      resetScannerAfterDelay(2000, 'qr');
      
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
      triggerHapticFeedback([100, 50, 100]);
      
      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      resetScannerAfterDelay(3000);
    }
  };

  // Function to validate OCR code (NEW)
  const validateOcrCode = async (text: string) => {
    setIsValidating(true);
    setError(null);
    setResult(null);
    setShowNotification(false);

    // Basic validation for 6 alphanumeric characters (already done by regex, but good for sanity check)
    if (!/^[a-zA-Z0-9]{6}$/.test(text)) {
      setError("صيغة الرمز النصي غير صالحة. يجب أن يتكون من 6 أحرف وأرقام. (رمز الخطأ: INVALID_OCR_FORMAT)");
      setIsValidating(false);
      setNotificationType('error');
      setShowNotification(true);
      triggerHapticFeedback([100, 50, 100]);
      setTimeout(() => setShowNotification(false), 5000);
      resetScannerAfterDelay(3000, 'ocr'); // Specify mode for reset
      return;
    }

    try {
      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND_OCR)");
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]);
        setTimeout(() => setShowNotification(false), 5000);
        return;
      }

      console.log("Sending OCR scan request with:", {
        endpoint: `/api/scan-ocr-code`, // New endpoint
        user: user,
        ocrCode: text
      });

      // Replace with actual API call to your new endpoint
      const scanResult = await apiRequest(
        "POST",
        `/api/scan-ocr-code`,
        { ocrCode: text } // Send the OCR code
      );

      const resultData = await scanResult.json();

      if (!resultData.success) {
        const errorCode = resultData.error_code ? ` (${resultData.error_code})` : '';
        let arabicErrorMessage = resultData.message || "فشل التحقق من الرمز النصي";
        let arabicErrorDetails = '';

        if (resultData.details) {
          arabicErrorDetails = translateErrorDetails(typeof resultData.details === 'string' ? resultData.details : JSON.stringify(resultData.details));
        }
        
        // You might need more specific translations for OCR errors if the backend provides them
        if (resultData.message.includes("not found") || resultData.message.includes("invalid")) {
          arabicErrorMessage = "الرمز النصي غير صالح أو غير موجود";
        }

        let completeErrorMessage = `${arabicErrorMessage}${errorCode}`;
        if (arabicErrorDetails) {
          completeErrorMessage += `\n\nتفاصيل: ${arabicErrorDetails}`;
        }

        setError(completeErrorMessage);
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]);
        setTimeout(() => setShowNotification(false), 5000);
        console.error('OCR Validation Error:', resultData);
        resetScannerAfterDelay(3000, 'ocr'); // Specify mode
        return;
      }

      // Success path for OCR
      setIsValidating(false);
      setResult(`تم التحقق من الرمز النصي: ${resultData.productName || text}`);
      if (resultData.pointsAwarded) setPointsAwarded(resultData.pointsAwarded);
      else setPointsAwarded(30); // Default points for OCR scan, adjust as needed

      triggerHapticFeedback([200]);
      setNotificationType('success');
      setShowNotification(true);
      setTimeout(() => {
        setShowNotification(false);
        setPointsAwarded(0);
      }, 3500);

      console.log("Scanned via OCR:", resultData.productName || text);
      refreshUser().catch(err => console.error("Error refreshing user after OCR scan:", err));
      
      // Invalidate queries similar to QR scan
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/badges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      queryClient.refetchQueries({ queryKey: [`/api/transactions?userId=${user?.id}`], exact: true });
      queryClient.refetchQueries({ queryKey: ['/api/badges', user?.id], exact: true });
      queryClient.refetchQueries({ queryKey: ['/api/users/me'], exact: true });

      toast({
        title: "تم التحقق من الرمز النصي بنجاح ✓",
        description: `المنتج: ${resultData.productName || text}\nالنقاط المكتسبة: ${resultData.pointsAwarded || 30}`,
        variant: "default",
      });

      resetScannerAfterDelay(2000, 'qr'); // Switch back to QR by default after successful OCR
      setScanMode('qr'); // Explicitly set mode back
      setShowOcrFallbackButton(false);

    } catch (err: any) {
      console.error("OCR Validation system error:", err);
      let arabicErrorMessage = "خطأ في نظام التحقق من الرمز النصي.";
      arabicErrorMessage += " (رمز الخطأ: OCR_VALIDATION_SYSTEM_ERROR)";
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
      triggerHapticFeedback([100, 50, 100]);
      setTimeout(() => setShowNotification(false), 5000);
      resetScannerAfterDelay(3000, 'ocr'); // Stay in OCR mode on system error
    }
  };

  const resetScannerAfterDelay = (delay = 1500, modeToEnable?: 'qr' | 'ocr') => {
    setTimeout(() => {
      try {
        const targetMode = modeToEnable || scanMode;
        if (targetMode === 'qr' && barcodeCaptureRef.current && !barcodeCaptureRef.current.isEnabled) {
          console.log("Re-enabling QR scanner after validation/delay");
          barcodeCaptureRef.current.setEnabled(true).catch(console.error);
          if (idCaptureRef.current?.isEnabled) idCaptureRef.current.setEnabled(false).catch(console.error);
          // Restart OCR fallback timer if we are re-enabling QR mode
          if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);
          ocrFallbackTimeoutRef.current = setTimeout(() => setShowOcrFallbackButton(true), 7000); // 7 seconds
        } else if (targetMode === 'ocr' && idCaptureRef.current && !idCaptureRef.current.isEnabled) {
          console.log("Re-enabling OCR scanner after validation/delay");
          idCaptureRef.current.setEnabled(true).catch(console.error);
          if (barcodeCaptureRef.current?.isEnabled) barcodeCaptureRef.current.setEnabled(false).catch(console.error);
        }
      } catch (err) {
        console.error("Error re-enabling scanner:", err);
      }
    }, delay);
  };

  const switchToOcrMode = async () => {
    if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);
    setShowOcrFallbackButton(false);
    if (barcodeCaptureRef.current?.isEnabled) {
      await barcodeCaptureRef.current.setEnabled(false);
    }
    if (idCaptureRef.current && !idCaptureRef.current.isEnabled) {
      await idCaptureRef.current.setEnabled(true);
    }
    setScanMode('ocr');
    setError(null); // Clear previous QR errors
    setResult("الرجاء توجيه الكاميرا نحو الرمز المكون من 6 أرقام أو أحرف.");
    toast({ title: "تم تفعيل وضع المسح النصي", description: "وجه الكاميرا نحو الرمز المكون من 6 أرقام/أحرف بجانب أو أسفل QR."});
  };

  const switchToQrMode = async () => {
    if (idCaptureRef.current?.isEnabled) {
      await idCaptureRef.current.setEnabled(false);
    }
    if (barcodeCaptureRef.current && !barcodeCaptureRef.current.isEnabled) {
      await barcodeCaptureRef.current.setEnabled(true);
       // Restart OCR fallback timer when switching to QR
      if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);
      ocrFallbackTimeoutRef.current = setTimeout(() => setShowOcrFallbackButton(true), 7000); // 7 seconds
    }
    setScanMode('qr');
    setError(null);
    setResult("وجه الكاميرا نحو رمز QR الخاص بالمنتج.");
     toast({ title: "تم تفعيل وضع مسح QR", description: "وجه الكاميرا نحو رمز QR."});
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const id = await import("@scandit/web-datacapture-id"); // Import ID module

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

        const {
          IdCapture,
          IdCaptureSettings,
          IdCaptureOverlay, // May not need overlay for simple text
          idCaptureLoader, // Loader for the ID module
          // Potentially TextFilter or similar for regex - to be discovered
        } = id as any;

        try {
          /* Initialise the engine (downloads WASM files automatically) */
          console.log("Using license key from environment secret");
          await configure({
            licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || "",
            libraryLocation:
              "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7.2.1/sdc-lib/", // Use core's sdc-lib
            moduleLoaders: [barcodeCaptureLoader(), idCaptureLoader()], // Add idCaptureLoader
            preloadEngine: true,
            engineLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7.2.1/build", // Use core's build
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
        const barcodeSettings = new BarcodeCaptureSettings();
        barcodeSettings.enableSymbologies([Symbology.QR]);
        
        const qrSymbologySettings = barcodeSettings.settingsForSymbology(Symbology.QR);
        qrSymbologySettings.isColorInvertedEnabled = true;
        
        console.log("QR Code settings:", {
          colorInverted: qrSymbologySettings.isColorInvertedEnabled,
          symbology: "QR"
        });
        
        const rectWidth = new NumberWithUnit(0.8, MeasureUnit.Fraction);
        const rectHeightToWidth = 1; 
        const rectangularLocation = RectangularLocationSelection.withWidthAndAspectRatio(
          rectWidth, rectHeightToWidth
        );
        barcodeSettings.locationSelection = rectangularLocation;
        
        try {
          if (typeof barcode.ScanIntention === 'object' && barcode.ScanIntention?.Smart) {
            barcodeSettings.scanIntention = barcode.ScanIntention.Smart;
          } else if (typeof core.ScanIntention === 'object' && core.ScanIntention?.Smart) {
            barcodeSettings.scanIntention = core.ScanIntention.Smart;
          } else if (typeof barcodeSettings.setProperty === 'function') {
            barcodeSettings.setProperty("barcodeCapture.scanIntention", "smart");
          } else {
            console.log("ScanIntention not available in API for BarcodeCapture, skipping this optimization");
          }
        } catch (settingsError) {
          console.warn("Error setting scan intention for BarcodeCapture:", settingsError);
        }
        
        barcodeSettings.setProperty("barcodeCapture.codeDuplicateFilter", 500);

        const localBarcodeCapture = await BarcodeCapture.forContext(context, barcodeSettings);
        barcodeCaptureRef.current = localBarcodeCapture; 
        
        localBarcodeCapture.addListener({
          didScan: async (_mode: any, session: any) => {
            const code = session.newlyRecognizedBarcodes[0];
            if (!code) return;
            
            await localBarcodeCapture.setEnabled(false);
            if (idCaptureRef.current?.isEnabled) await idCaptureRef.current.setEnabled(false);

            const url = code.data;
            console.log("QR code detected:", url);
            if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);
            setShowOcrFallbackButton(false);
            
            await validateQrCode(url);
          }
        });

        /* Configure ID Capture for OCR */
        const localIdCaptureSettings = new IdCaptureSettings();
        // This is the crucial part: How to set a regex for generic text?
        // Option 1: If TextFilter exists and can be applied to IdCaptureSettings
        // const textFilter = new id.TextFilter(); // Hypothetical
        // textFilter.regex = "^[a-zA-Z0-9]{6}$";
        // localIdCaptureSettings.textFilter = textFilter; // Hypothetical

        // Option 2: If IdCaptureSettings has a direct regex property or method for OCR
        // localIdCaptureSettings.setOcrRegex("^[a-zA-Z0-9]{6}$"); // Hypothetical

        // Option 3: Configure it to accept any text in a region and filter client-side (less ideal)
        // For now, we enable generic ID scanning and hope it picks up text that we can filter.
        // We might need to enable specific document types if generic text isn't directly supported.
        // Example: localIdCaptureSettings.supportedDocuments = [id.IdDocumentType.Generic]; (Hypothetical)
        
        // A more direct approach might be to set a property if the API supports it:
        // This is a guess based on older SDK patterns and common OCR configurations
        try {
            if (typeof localIdCaptureSettings.setProperty === 'function') {
                localIdCaptureSettings.setProperty("textCapture.regex", "^[a-zA-Z0-9]{6}$");
                console.log("Attempted to set textCapture.regex on IdCaptureSettings");
            } else {
                console.warn("IdCaptureSettings.setProperty not available. OCR Regex might not be applied.");
            }
        } catch(e) {
            console.error("Error trying to set OCR regex property:", e);
        }
        // If there's a specific recognition mode for text in IdCapture:
        // localIdCaptureSettings.recognitionMode = id.RecognitionMode.Text; // Hypothetical

        const localIdCapture = await IdCapture.forContext(context, localIdCaptureSettings);
        idCaptureRef.current = localIdCapture;

        localIdCapture.addListener({
          didCaptureId: async (_idCapture: any, session: any) => {
            const capturedId = session.newlyCapturedId;
            if (!capturedId || !capturedId.result) return; // result might contain OCRed text fields
            
            await localIdCapture.setEnabled(false);
            if (barcodeCaptureRef.current?.isEnabled) await barcodeCaptureRef.current.setEnabled(false);

            // We need to find where the 6-digit code would be in the capturedId.result
            // This depends heavily on how IdCapture returns generic text or if it tries to parse it as an ID.
            // For now, let's assume there's a field or a way to get raw text.
            // This is highly speculative and will need adjustment based on actual SDK behavior.
            let foundText: string | null = null;
            
            // Try to find a field that matches the regex from common ID fields.
            // This is a placeholder until we know how IdCapture exposes OCR text.
            const commonTextFields = ['documentNumber', 'personalNumber', 'mrzResult?.capturedMrz']; 
            if (capturedId.result) {
                for (const key of commonTextFields) {
                    let potentialText = capturedId.result[key];
                    if (typeof potentialText === 'string' && /^[a-zA-Z0-9]{6}$/.test(potentialText.replace(/[^a-zA-Z0-9]/g, '')) ) {
                        foundText = potentialText.replace(/[^a-zA-Z0-9]/g, '').substring(0,6);
                        break;
                    }
                }
                // If not found in common fields, check if there's a generic text result array
                if (!foundText && Array.isArray(capturedId.result.texts)) {
                    for (const textItem of capturedId.result.texts) {
                        if (typeof textItem.value === 'string' && /^[a-zA-Z0-9]{6}$/.test(textItem.value.replace(/[^a-zA-Z0-9]/g, ''))) {
                            foundText = textItem.value.replace(/[^a-zA-Z0-9]/g, '').substring(0,6);
                            break;
                        }
                    }
                }
                 // Last resort: stringify and regex search (crude)
                if (!foundText) {
                    const resultString = JSON.stringify(capturedId.result);
                    const match = resultString.match(/[a-zA-Z0-9]{6}/);
                    if (match) foundText = match[0];
                }
            }

            if (foundText) {
              console.log("OCR text potentially detected:", foundText);
              await validateOcrCode(foundText);
            } else {
              console.log("No 6-digit alphanumeric code found in IdCapture result or format not as expected.", capturedId.result);
              // Re-enable OCR scanning if no valid text found to allow retry
              resetScannerAfterDelay(1000, 'ocr');
            }
          },
          // didError is also important for IdCapture
           didErrorOnIdCapture: (_idCapture: any, error: any, session: any) => {
            console.error("Error in IdCapture:", error);
            setError(`خطأ في مسح النص: ${error.message}. حاول مرة أخرى.`);
            setNotificationType('error');
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 5000);
            resetScannerAfterDelay(1500, 'ocr');
          }
        });
        
        // Set initial enabled state based on scanMode
        if (scanMode === 'qr') {
            await localBarcodeCapture.setEnabled(true);
            await localIdCapture.setEnabled(false);
            // Start OCR fallback timer
            if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);
            ocrFallbackTimeoutRef.current = setTimeout(() => setShowOcrFallbackButton(true), 7000); // 7 seconds timeout
        } else { // scanMode === 'ocr'
            await localBarcodeCapture.setEnabled(false);
            await localIdCapture.setEnabled(true);
        }

        /* Provide disposer so we shut everything down on unmount */
        dispose = async () => {
          try {
            if (ocrFallbackTimeoutRef.current) clearTimeout(ocrFallbackTimeoutRef.current);
            if (localBarcodeCapture) {
              await localBarcodeCapture.setEnabled(false);
            }
            if (localIdCapture) { // Dispose IdCapture too
              await localIdCapture.setEnabled(false);
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
            <h1 className="text-xl font-bold">
                {scanMode === 'qr' ? "المسح المتقدم (QR)" : "المسح المتقدم (نصي)"}
            </h1>
            
            {/* Mode Toggle and License Status */}
            <div className="flex items-center gap-4">
              {/* Mode Switcher - Show only if OCR fallback is not active OR if user manually switched */}
              {licenseStatus === 'initialized' && (
                <button
                  onClick={() => scanMode === 'qr' ? switchToOcrMode() : switchToQrMode()}
                  className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                  title={scanMode === 'qr' ? "التبديل إلى المسح النصي (OCR)" : "التبديل إلى مسح QR"}
                >
                  {scanMode === 'qr' ? <ScanText size={14} /> : <Info size={14} />} {/* Use appropriate QR icon if available */}
                  <span>{scanMode === 'qr' ? "مسح نصي" : "مسح QR"}</span>
                </button>
              )}

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
        </div>
        
        {/* Scanner viewport - using grid cell to take all available space */}
        <div className="relative overflow-hidden">
          <div
            ref={scannerRef}
            className="absolute inset-0 bg-black overflow-hidden"
            aria-label="مساحة مسح رمز الاستجابة السريعة"
          />
          
          {/* Scanner overlay - scanning guides (80% of view as square to match locationSelection) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[min(80vw,80vh)] max-w-md aspect-square">
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
                {scanMode === 'qr' 
                  ? "وجه الكاميرا نحو رمز QR الخاص بالمنتج"
                  : "وجه الكاميرا نحو الرمز المكون من 6 أرقام/أحرف"}
              </div>
            </div>
          </div>
          
          {/* OCR Fallback Button */}
          {showOcrFallbackButton && scanMode === 'qr' && !isValidating && (
            <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={switchToOcrMode}
                className="bg-secondary hover:bg-secondary/90 text-white font-medium rounded-full px-6 py-3 text-sm shadow-lg animate-pulse"
              >
                لم يتم التعرف على QR؟ <span className="underline">جرب مسح الرمز النصي (6 أرقام)</span>
              </button>
            </div>
          )}
          
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