import { useEffect, useRef, useState, useCallback } from "react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-provider";
import { Loader2, CheckCircle2, AlertCircle, Info, QrCode, TextCursorInput } from "lucide-react";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Button } from "@/components/ui/button";
import { createWorker } from 'tesseract.js';

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
 * Advanced scanner page – powered by Scandit Web SDK for QR codes and Tesseract.js for OCR
 * Note: Scandit modules are pulled dynamically via CDN import-map (see index.html).
 */
export default function AdvancedScanPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const ocrVideoRef = useRef<HTMLVideoElement>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<'initialized' | 'failed' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  
  // Scanner mode state (QR or OCR) – default to OCR for testing
  const [scannerMode, setScannerMode] = useState<'qr' | 'ocr'>('ocr');
  const [statusMessage, setStatusMessage] = useState<string>("جارٍ البحث عن رمز QR...");
  
  // References to context and capture objects
  const contextRef = useRef<any>(null);
  const captureRef = useRef<any>(null); // Reference for barcode capture
  
  // OCR-specific state
  const [isOcrInitializing, setIsOcrInitializing] = useState(false);
  const [ocrWorker, setOcrWorker] = useState<any>(null);
  const [ocrStream, setOcrStream] = useState<MediaStream | null>(null);
  const ocrScanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State for scan result notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | null>(null);
  
  // OCR debugging state
  const [ocrActivity, setOcrActivity] = useState(false);
  const [lastDetectedText, setLastDetectedText] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const [roiDebugInfo, setRoiDebugInfo] = useState<{
    videoWidth: number;
    videoHeight: number;
    containerWidth: number;
    containerHeight: number;
    roiX: number;
    roiY: number;
    roiWidth: number;
    roiHeight: number;
  } | null>(null);
  
  // iOS debug state
  const [iosErrorDetails, setIosErrorDetails] = useState<string>("");
  const [loadingStep, setLoadingStep] = useState<string>("");
  
  // Video diagnostic state for iOS debugging
  const [videoState, setVideoState] = useState<{
    readyState: number;
    paused: boolean;
    currentTime: number;
    duration: number;
    videoWidth: number;
    videoHeight: number;
    hasStream: boolean;
  }>({
    readyState: 0,
    paused: true,
    currentTime: 0,
    duration: 0,
    videoWidth: 0,
    videoHeight: 0,
    hasStream: false
  });

  // Add new state for OCR optimization
  const [detectionBuffer, setDetectionBuffer] = useState<string[]>([]);
  const [lastValidatedCode, setLastValidatedCode] = useState<string | null>(null);
  const [validationCooldown, setValidationCooldown] = useState(false);
  const DETECTION_BUFFER_SIZE = 3; // Require code to appear in 3 consecutive frames
  const VALIDATION_COOLDOWN_MS = 5000; // 5 second cooldown after validation
  
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
        triggerHapticFeedback([100, 50, 100]);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        // Re-enable QR scanner after delay
        setTimeout(() => {
          if (scannerMode === 'qr' && captureRef.current) {
            captureRef.current.setEnabled(true).catch(console.error);
          }
        }, 1500);
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
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        // Re-enable QR scanner after delay
        setTimeout(() => {
          if (scannerMode === 'qr' && captureRef.current) {
            captureRef.current.setEnabled(true).catch(console.error);
          }
        }, 1500);
        return;
      }

      // Step 3: Send to server for validation and processing
      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND)");
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]);
        
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
        
        let arabicErrorMessage = result.message;
        let arabicErrorDetails = '';
        
        if (result.details) {
          if (typeof result.details === 'string') {
            arabicErrorDetails = translateErrorDetails(result.details);
          } else if (result.details.duplicate) {
            arabicErrorDetails = "تم مسح هذا الرمز مسبقاً";
          } else if (result.details.message) {
            arabicErrorDetails = translateErrorDetails(result.details.message);
          } else {
            const detailsStr = JSON.stringify(result.details, null, 2);
            arabicErrorDetails = translateErrorDetails(detailsStr);
          }
        }
        
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
        
        let completeErrorMessage = `${arabicErrorMessage}${errorCode}`;
        if (arabicErrorDetails) {
          completeErrorMessage += `\n\nتفاصيل: ${arabicErrorDetails}`;
        }
        
        setError(completeErrorMessage);
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        console.error('QR Validation Error:', {
          message: result.message,
          code: result.error_code,
          details: result.details
        });
        
        // Re-enable QR scanner after delay
        setTimeout(() => {
          if (scannerMode === 'qr' && captureRef.current) {
            captureRef.current.setEnabled(true).catch(console.error);
          }
        }, 1500);
        
        return;
      }
      
      // Success path
      setIsValidating(false);
      setResult(`تم التحقق من المنتج: ${result.productName}`);
      
      if (result.pointsAwarded) {
        setPointsAwarded(result.pointsAwarded);
      } else {
        setPointsAwarded(50);
      }
      
      triggerHapticFeedback([200]);
      
      setNotificationType('success');
      setShowNotification(true);
      
      setTimeout(() => {
        setShowNotification(false);
        setPointsAwarded(0);
      }, 3500);
      
      console.log("Scanned product:", result.productName);
      
      refreshUser()
        .then(() => console.log("User refreshed after successful scan"))
        .catch(err => console.error("Error refreshing user after scan:", err));
      
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/badges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      
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
      
      toast({
        title: "تم التحقق من المنتج بنجاح ✓",
        description: `المنتج: ${result.productName || "غير معروف"}\nالنقاط المكتسبة: ${result.pointsAwarded || 10}`,
        variant: "default",
      });
      
      // Re-enable QR scanner after success
      setTimeout(() => {
        if (scannerMode === 'qr' && captureRef.current) {
          captureRef.current.setEnabled(true).catch(console.error);
        }
      }, 2000);
      
    } catch (err: any) {
      console.error("QR Validation error:", err);
      
      let arabicErrorMessage = "خطأ في التحقق من رمز QR. يرجى المحاولة مرة أخرى.";
      arabicErrorMessage += " (رمز الخطأ: QR_VALIDATION_ERROR)";
      
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
      
      setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      // Re-enable QR scanner after error
      setTimeout(() => {
        if (scannerMode === 'qr' && captureRef.current) {
          captureRef.current.setEnabled(true).catch(console.error);
        }
      }, 3000);
    }
  };

  // Function to validate extracted code (6-digit alphanumeric)
  const validateExtractedCode = async (code: string) => {
    setIsValidating(true);
    setError(null);
    setResult(null);
    setShowNotification(false);

    try {
      console.log("Validating extracted code:", code);

      if (!user || !user.id) {
        setError("لم يتم العثور على معلومات المستخدم. يرجى تسجيل الدخول مرة أخرى. (رمز الخطأ: USER_NOT_FOUND)");
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        return;
      }
      
      console.log("Sending OCR scan request with:", {
        endpoint: `/api/scan-ocr`,
        user: user,
        code: code
      });
      
      const scanResult = await apiRequest(
        "POST", 
        `/api/scan-ocr`, 
        {
          code
        }
      );
      
      const result = await scanResult.json();
      
      if (!result.success) {
        const errorCode = result.error_code ? ` (${result.error_code})` : '';
        
        let arabicErrorMessage = result.message;
        let arabicErrorDetails = '';
        
        if (result.details) {
          if (typeof result.details === 'string') {
            arabicErrorDetails = translateErrorDetails(result.details);
          } else if (result.details.duplicate) {
            arabicErrorDetails = "تم مسح هذا الرمز مسبقاً";
          } else if (result.details.message) {
            arabicErrorDetails = translateErrorDetails(result.details.message);
          } else {
            const detailsStr = JSON.stringify(result.details, null, 2);
            arabicErrorDetails = translateErrorDetails(detailsStr);
          }
        }
        
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
        
        let completeErrorMessage = `${arabicErrorMessage}${errorCode}`;
        if (arabicErrorDetails) {
          completeErrorMessage += `\n\nتفاصيل: ${arabicErrorDetails}`;
        }
        
        setError(completeErrorMessage);
        setIsValidating(false);
        setNotificationType('error');
        setShowNotification(true);
        triggerHapticFeedback([100, 50, 100]);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        
        console.error('OCR Validation Error:', {
          message: result.message,
          code: result.error_code,
          details: result.details
        });
        
        return;
      }
      
      // Success path
      setIsValidating(false);
      setResult(`تم التحقق من المنتج: ${result.productName}`);
      
      if (result.pointsAwarded) {
        setPointsAwarded(result.pointsAwarded);
      } else {
        setPointsAwarded(50);
      }
      
      triggerHapticFeedback([200]);
      
      setNotificationType('success');
      setShowNotification(true);
      
      setTimeout(() => {
        setShowNotification(false);
        setPointsAwarded(0);
      }, 3500);
      
      console.log("Scanned product:", result.productName);
      
      refreshUser()
        .then(() => console.log("User refreshed after successful scan"))
        .catch(err => console.error("Error refreshing user after scan:", err));
      
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/badges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      
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
      
      toast({
        title: "تم التحقق من المنتج بنجاح ✓",
        description: `المنتج: ${result.productName || "غير معروف"}\nالنقاط المكتسبة: ${result.pointsAwarded || 10}`,
        variant: "default",
      });
      
    } catch (err: any) {
      console.error("OCR Validation error:", err);
      
      let arabicErrorMessage = "خطأ في التحقق من الرمز المستخرج. يرجى المحاولة مرة أخرى.";
      arabicErrorMessage += " (رمز الخطأ: OCR_VALIDATION_ERROR)";
      
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
      
      setTimeout(() => {
        setShowNotification(false);
      }, 5000);
    }
  };

  // Initialize OCR mode with camera only first
  const initializeOCR = async () => {
    try {
      setIsOcrInitializing(true);
      setStatusMessage("جارٍ تهيئة نظام قراءة النصوص...");
      setIosErrorDetails("");
      setLoadingStep("بدء التهيئة...");

      /* ---------------------- Camera initialisation ---------------------- */
      console.log("Requesting camera access for OCR...");
      setLoadingStep("طلب إذن الكاميرا...");
      
      // Detect mobile devices
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      console.log("Device detection:", { isMobile, isIOS, userAgent: navigator.userAgent });
      
      try {
        // Test if camera is available first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        console.log("Available cameras:", cameras.length);
        
        if (cameras.length === 0) {
          throw new Error("No cameras found on device");
        }
        
        // Progressive camera constraint strategy for iOS
        let videoConstraints: any = {
          facingMode: "environment"
        };
        
        // Don't specify resolution constraints for iOS - let it choose optimal
        if (!isIOS) {
          videoConstraints.width = { ideal: isMobile ? 720 : 1280 };
          videoConstraints.height = { ideal: isMobile ? 480 : 720 };
        }
        
        console.log("Using video constraints:", videoConstraints);
        setLoadingStep("تشغيل الكاميرا...");
        
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false
          });
        } catch (constraintError) {
          console.warn("Failed with specific constraints, trying basic:", constraintError);
          setLoadingStep("إعادة محاولة بإعدادات أساسية...");
          
          // Ultra-basic fallback for iOS
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
        
        console.log("Camera access granted for OCR");
        setOcrStream(stream);
        setLoadingStep("إعداد الفيديو...");

        if (ocrVideoRef.current) {
          const video = ocrVideoRef.current;
          
          // Critical iOS Safari video setup sequence
          video.srcObject = null; // Reset first
          
          // iOS-specific attributes - MUST be set before srcObject
          video.playsInline = true;
          video.muted = true;
          // Enable autoplay for muted inline video to satisfy iOS autoplay policy
          video.autoplay = true;
          video.setAttribute('autoplay', 'true');
          video.controls = false;
          video.preload = "metadata";
          
          // Set attributes as well for older iOS versions
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('muted', 'true');
          
          // Now set the stream
          video.srcObject = stream;
          
          // Force load to ensure metadata is read (needed on certain iOS versions)
          try {
            video.load();
          } catch (loadErr) {
            console.warn("video.load() threw", loadErr);
          }
          
          // Immediate play attempt (within user gesture) – improves start-up on iOS
          try {
            await video.play();
            console.log("Immediate video.play() succeeded");
          } catch (immediatePlayErr) {
            console.warn("Immediate video.play() failed:", immediatePlayErr);
          }
          
          setLoadingStep("انتظار جاهزية الفيديو...");
          
          // Comprehensive iOS video loading strategy
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Video load timeout after 20 seconds on ${isIOS ? 'iOS' : 'mobile'}`));
            }, 20000); // Increased timeout for iOS
            
            let resolved = false;
            let loadAttempts = 0;
            const maxAttempts = 5;
            
            const attemptPlay = async () => {
              if (resolved || loadAttempts >= maxAttempts) return;
              
              loadAttempts++;
              console.log(`Play attempt ${loadAttempts} on ${isIOS ? 'iOS' : 'mobile'}`);
              
              try {
                await video.play();
                
                // Wait a bit then check if it's actually playing
                setTimeout(() => {
                  if (!resolved && !video.paused && video.readyState >= 2) {
                    console.log("Video playing successfully");
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                  } else if (!resolved && loadAttempts < maxAttempts) {
                    // Try again after a delay
                    setTimeout(attemptPlay, 1000);
                  }
                }, 500);
                
              } catch (playError) {
                console.warn(`Play attempt ${loadAttempts} failed:`, playError);
                
                if (loadAttempts < maxAttempts) {
                  // Try again after progressively longer delays
                  setTimeout(attemptPlay, loadAttempts * 1000);
                } else if (!resolved) {
                  // Final fallback - just check if video has some data
                  if (video.readyState >= 1) {
                    console.log("Video has some data, continuing anyway");
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                  }
                }
              }
            };
            
            const onLoadedData = () => {
              if (resolved) return;
              console.log("Video loadeddata event, readyState:", video.readyState);
              
              // On iOS, try to play when we get loadeddata
              if (isIOS && video.readyState >= 2) {
                attemptPlay();
              } else if (!isIOS && video.readyState >= 3) {
                // Desktop can be more strict
                resolved = true;
                clearTimeout(timeout);
                cleanup();
                resolve();
              }
            };
            
            const onCanPlay = () => {
              if (resolved) return;
              console.log("Video canplay event, readyState:", video.readyState);
              attemptPlay();
            };
            
            const onPlaying = () => {
              if (resolved) return;
              console.log("Video playing event");
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve();
            };
            
            const onError = (error: any) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              console.error("Video error:", error);
              reject(new Error(`Video loading error: ${error.type || 'Unknown'}`));
            };
            
            const cleanup = () => {
              video.removeEventListener('loadeddata', onLoadedData);
              video.removeEventListener('loadedmetadata', onLoadedData);
              video.removeEventListener('canplay', onCanPlay);
              video.removeEventListener('canplaythrough', onCanPlay);
              video.removeEventListener('playing', onPlaying);
              video.removeEventListener('error', onError);
            };
            
            // Set up event listeners
            video.addEventListener('loadeddata', onLoadedData);
            video.addEventListener('loadedmetadata', onLoadedData);
            video.addEventListener('canplay', onCanPlay);
            video.addEventListener('canplaythrough', onCanPlay);
            video.addEventListener('playing', onPlaying);
            video.addEventListener('error', onError);
            
            // Start the loading process
            // (Intentionally omitted `video.load()` to avoid iOS readyState = 0 bug)
            
            // Initial attempt after a short delay
            setTimeout(() => {
              if (!resolved) {
                attemptPlay();
              }
            }, 500);
            
            // Also try if video already has data
            if (video.readyState >= 2) {
              setTimeout(onLoadedData, 100);
            }
          });
          
          console.log("OCR video stream started successfully");
        }
        
      } catch (cameraError: any) {
        console.error("Camera error:", cameraError);
        setIosErrorDetails(`Camera Error: ${cameraError.message}`);
        throw new Error(`Camera initialization failed: ${cameraError.message}`);
      }

      /* ---------------------- Tesseract initialisation ------------------- */
      setStatusMessage("جارٍ تحميل محرك التعرف على النصوص...");
      setLoadingStep("تحميل Tesseract...");
      console.log("Loading Tesseract worker...");

      let worker: any = null;
      try {
        // Use optimized Tesseract.js settings for mobile
        const workerOptions: any = {
          logger: (m: any) => {
            console.log('Tesseract:', m);
            if (m.status) {
              setLoadingStep(`Tesseract: ${m.status} (${Math.round(m.progress * 100)}%)`);
            }
          }
        };
        
        console.log("Creating Tesseract worker with optimal settings");
        worker = await createWorker('eng', 1, workerOptions);
        
        setLoadingStep("إعداد معاملات OCR...");

        // Enhanced parameters for better OCR recognition - English only
        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: isMobile ? "6" : "8", // Uniform text block vs single text line
          tessedit_ocr_engine_mode: "1", // Neural nets LSTM engine only
          // Additional quality improvements
          tessjs_create_hocr: "0",
          tessjs_create_tsv: "0",
          user_defined_dpi: "300",
          // Force English language
          tessedit_enable_dict_correction: "1",
          language_model_penalty_non_dict_word: "0.8",
          language_model_penalty_non_freq_dict_word: "0.6"
        });

        setOcrWorker(worker);
        console.log("Tesseract worker initialized successfully");
        
      } catch (tesseractError: any) {
        console.error("Tesseract error:", tesseractError);
        setIosErrorDetails(`Tesseract Error: ${tesseractError.message}`);
        throw new Error(`Tesseract initialization failed: ${tesseractError.message}`);
      }

      /* ---------------------------- Done --------------------------------- */
      setStatusMessage("وضع قراءة النصوص جاهز");
      setLoadingStep("اكتمال التهيئة ✓");
      setIsOcrInitializing(false);

      // Start OCR scanning
      console.log("Starting OCR scanning...");
      if (worker) {
        startOcrScanning(worker);
      } else {
        throw new Error("Worker not initialized properly");
      }
    } catch (error: any) {
      console.error("OCR initialization error:", error);

      let errorMessage = "فشل تهيئة نظام قراءة النصوص. ";
      if (error?.message) {
        if (error.message.includes("camera") || error.message.includes("Camera")) {
          errorMessage += "يرجى التأكد من السماح بالوصول إلى الكاميرا من إعدادات Safari.";
        } else if (error.message.includes("permission") || error.message.includes("NotAllowedError")) {
          errorMessage += "تم رفض إذن الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.";
        } else if (error.message.includes("NotFoundError") || error.message.includes("No cameras")) {
          errorMessage += "لم يتم العثور على كاميرا. تأكد من وجود كاميرا خلفية.";
        } else if (error.message.includes("NetworkError") || error.message.includes("Load failed")) {
          errorMessage += "فشل تحميل ملفات التعرف على النصوص عبر الشبكة. تأكد من قوة الاتصال بالإنترنت وإعادة تحميل الصفحة.";
        } else if (error.message.includes("timeout")) {
          errorMessage += "انتهت مهلة تحميل الكاميرا. يرجى المحاولة مرة أخرى.";
        } else if (error.message.includes("HTTPS") || error.message.includes("secure")) {
          errorMessage += "يتطلب الوصول للكاميرا اتصال آمن (HTTPS).";
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += "خطأ غير معروف.";
      }
      
      setIosErrorDetails(error?.message || "Unknown error");

      // Reset OCR state and resources
      await cleanupOCR();

      // Show error to the user
      setError(errorMessage);
      setIsOcrInitializing(false);
      setLoadingStep("");
      setNotificationType("error");
      setShowNotification(true);
      triggerHapticFeedback([100, 50, 100]);

      setTimeout(() => {
        setShowNotification(false);
      }, 5000);

      // Revert back to QR mode for safety
      setScannerMode("qr");
      setStatusMessage("جارٍ البحث عن رمز QR...");
    }
  };

  // Helper function to preprocess image for better OCR
  const preprocessImageForOCR = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale conversion
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      
      // Increase contrast
      const contrast = 1.5; // Contrast factor
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const newGray = factor * (gray - 128) + 128;
      
      // Apply threshold to make text clearer (simple binarization)
      const threshold = 128;
      const finalValue = newGray > threshold ? 255 : 0;
      
      data[i] = finalValue;
      data[i + 1] = finalValue;
      data[i + 2] = finalValue;
    }
    
    context.putImageData(imageData, 0, 0);
  };

  // Enhanced code validation with stricter rules
  const isValidProductCode = (code: string): boolean => {
    // Must be exactly 6 characters
    if (code.length !== 6) return false;
    
    // Must contain at least one letter and one number
    const hasLetter = /[A-Z]/.test(code);
    const hasNumber = /[0-9]/.test(code);
    
    // Avoid common OCR mistakes
    // Exclude codes that are all the same character
    const uniqueChars = new Set(code.split('')).size;
    if (uniqueChars < 3) return false;
    
    // Exclude sequential patterns like "123456" or "ABCDEF"
    const isSequential = (str: string) => {
      for (let i = 1; i < str.length; i++) {
        if (Math.abs(str.charCodeAt(i) - str.charCodeAt(i - 1)) !== 1) {
          return false;
        }
      }
      return true;
    };
    
    if (isSequential(code)) return false;
    
    return hasLetter && hasNumber;
  };

  // Start OCR scanning process with optimizations
  const startOcrScanning = (workerOverride?: any) => {
    console.log("🚀 startOcrScanning called", { workerOverride: !!workerOverride });
    
    if (ocrScanIntervalRef.current) {
      console.log("Clearing existing OCR interval");
      clearInterval(ocrScanIntervalRef.current);
    }

    console.log("Setting up OCR scanning interval...");
    ocrScanIntervalRef.current = setInterval(async () => {
      console.log("⏰ OCR interval tick - checking conditions...");
      
      // Use workerOverride if provided, otherwise use state
      const activeWorker = workerOverride || ocrWorker;
      
      // Check if we're in cooldown period
      if (validationCooldown) {
        console.log("❌ OCR scan skipped - in cooldown period");
        return;
      }
      
      // Debug the conditions
      console.log("OCR Conditions check:", {
        ocrWorker: !!ocrWorker,
        activeWorker: !!activeWorker,
        workerOverride: !!workerOverride,
        ocrVideoRef: !!ocrVideoRef.current,
        ocrCanvasRef: !!ocrCanvasRef.current,
        isValidating: isValidating,
        videoReadyState: ocrVideoRef.current?.readyState,
        videoPaused: ocrVideoRef.current?.paused
      });
      
      if (!activeWorker || !ocrVideoRef.current || !ocrCanvasRef.current || isValidating) {
        console.log("❌ OCR scan skipped due to conditions");
        return;
      }

      try {
        console.log("✅ Starting OCR scan process");
        setOcrActivity(true);
        setScanCount(prev => prev + 1);
        
        const video = ocrVideoRef.current;
        const canvas = ocrCanvasRef.current;
        const context = canvas.getContext('2d');

        // Enhanced readyState and playing checks for iOS
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        // For iOS, be more lenient with readyState but ensure video is actually playing
        const minReadyState = isMobile ? 1 : 3; // iOS: HAVE_METADATA, Desktop: HAVE_FUTURE_DATA
        const isVideoReady = video.readyState >= minReadyState && !video.paused;
        
        if (!context || !isVideoReady) {
          setOcrActivity(false);
          console.log("OCR scan skipped - video not ready:", { 
            readyState: video.readyState, 
            minRequired: minReadyState,
            paused: video.paused,
            context: !!context,
            isMobile,
            isIOS 
          });
          
          // On iOS, try to resume playing if paused
          if (isIOS && video.paused && video.readyState >= 1) {
            console.log("Attempting to resume iOS video playback");
            video.play().catch(err => console.warn("Failed to resume video:", err));
          }
          
          return;
        }

        // Get video dimensions - handle cases where they might be 0
        const videoWidth = video.videoWidth || video.offsetWidth || 640;
        const videoHeight = video.videoHeight || video.offsetHeight || 480;
        
        if (videoWidth === 0 || videoHeight === 0) {
          console.log("Video dimensions not available yet:", { videoWidth, videoHeight });
          setOcrActivity(false);
          return;
        }

        // Calculate the actual visible area when using object-fit: cover
        // The video element fills the entire screen, so we need to calculate what portion is visible
        const containerWidth = video.offsetWidth;
        const containerHeight = video.offsetHeight;
        const videoAspectRatio = videoWidth / videoHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        let actualVisibleWidth, actualVisibleHeight;
        let offsetX = 0, offsetY = 0;
        
        if (videoAspectRatio > containerAspectRatio) {
          // Video is wider than container - crop sides
          actualVisibleHeight = videoHeight;
          actualVisibleWidth = videoHeight * containerAspectRatio;
          offsetX = (videoWidth - actualVisibleWidth) / 2;
          offsetY = 0;
        } else {
          // Video is taller than container - crop top/bottom
          actualVisibleWidth = videoWidth;
          actualVisibleHeight = videoWidth / containerAspectRatio;
          offsetX = 0;
          offsetY = (videoHeight - actualVisibleHeight) / 2;
        }

        // OPTIMIZATION 1: Region of Interest (ROI) - Only scan the center region
        // Define ROI as center 60% horizontally and center 30% vertically of VISIBLE area
        const roiWidthPercent = 0.6;
        const roiHeightPercent = 0.3;
        
        const roiWidth = Math.floor(actualVisibleWidth * roiWidthPercent);
        const roiHeight = Math.floor(actualVisibleHeight * roiHeightPercent);
        const roiX = Math.floor(offsetX + (actualVisibleWidth - roiWidth) / 2);
        const roiY = Math.floor(offsetY + (actualVisibleHeight - roiHeight) / 2);
        
        // Update debug info
        setRoiDebugInfo({
          videoWidth,
          videoHeight,
          containerWidth,
          containerHeight,
          roiX,
          roiY,
          roiWidth,
          roiHeight
        });
        
        // Set canvas size to ROI dimensions
        canvas.width = roiWidth;
        canvas.height = roiHeight;
        
        console.log(`OCR Scan #${scanCount}: ROI ${roiWidth}x${roiHeight} at (${roiX}, ${roiY}) from video ${videoWidth}x${videoHeight} in container ${containerWidth}x${containerHeight}`);
        
        // Draw only the ROI region to canvas
        try {
          context.drawImage(
            video, 
            roiX, roiY, roiWidth, roiHeight,  // Source rectangle (from video)
            0, 0, roiWidth, roiHeight         // Destination rectangle (on canvas)
          );
        } catch (drawError) {
          console.error("Failed to draw video frame:", drawError);
          setOcrActivity(false);
          return;
        }

        // OPTIMIZATION 2: Preprocess the image for better OCR accuracy
        preprocessImageForOCR(canvas, context);

        // Get preprocessed image data for OCR
        const imageData = canvas.toDataURL('image/png', 1.0); // Max quality for text

        console.log(`OCR Scan #${scanCount}: Processing ROI ${roiWidth}x${roiHeight} from position (${roiX}, ${roiY})`);

        // Perform OCR on the image using the active worker
        const startTime = Date.now();
        const { data } = await activeWorker.recognize(imageData);
        const processingTime = Date.now() - startTime;
        
        // OPTIMIZATION 3: Use confidence scores
        const minConfidence = 70; // Minimum confidence threshold
        
        console.log(`OCR completed in ${processingTime}ms. Raw text detected:`, JSON.stringify(data.text));
        console.log(`OCR confidence:`, data.confidence);
        
        // Always update the last detected text, even if confidence is low
        const detectedText = data.text || '';
        setLastDetectedText(detectedText.trim());
        
        // Only process if confidence is high enough
        if (data.confidence < minConfidence) {
          console.log(`❌ OCR confidence too low: ${data.confidence} < ${minConfidence}`);
          setOcrActivity(false);
          return;
        }
        
        // Enhanced code detection with stricter validation
        const cleanText = detectedText.replace(/[^A-Za-z0-9\s]/g, '').toUpperCase();
        const codeRegex = /\b[A-Z0-9]{6}\b/g;
        const matches = cleanText.match(codeRegex);

        if (matches && matches.length > 0) {
          // Filter matches through validation
          const validCodes = matches.filter(isValidProductCode);
          
          if (validCodes.length > 0) {
            const detectedCode = validCodes[0];
            console.log("✅ OCR detected valid code:", detectedCode);
            
            // OPTIMIZATION 4: Multi-frame validation
            // Add to detection buffer
            setDetectionBuffer(prev => {
              const newBuffer = [...prev, detectedCode].slice(-DETECTION_BUFFER_SIZE);
              
              // Check if all codes in buffer are the same
              if (newBuffer.length >= DETECTION_BUFFER_SIZE && 
                  newBuffer.every(code => code === newBuffer[0])) {
                
                // All codes match - proceed with validation
                const codeToValidate = newBuffer[0];
                
                // Check if this code was recently validated
                if (codeToValidate !== lastValidatedCode) {
                  console.log("🎯 Consistent code detected across frames:", codeToValidate);
                  
                  // Clear buffer and set cooldown
                  setDetectionBuffer([]);
                  setLastValidatedCode(codeToValidate);
                  setValidationCooldown(true);
                  
                  // Stop scanning while validating
                  if (ocrScanIntervalRef.current) {
                    clearInterval(ocrScanIntervalRef.current);
                    ocrScanIntervalRef.current = null;
                  }
                  
                  setOcrActivity(false);
                  
                  // Validate the detected code
                  validateExtractedCode(codeToValidate).finally(() => {
                    // Resume scanning after a delay
                    setTimeout(() => {
                      setValidationCooldown(false);
                      if (scannerMode === 'ocr' && !isValidating) {
                        startOcrScanning(); // Resume with state-based worker
                      }
                    }, VALIDATION_COOLDOWN_MS);
                  });
                } else {
                  console.log("❌ Code was recently validated, skipping:", codeToValidate);
                }
              }
              
              return newBuffer;
            });
          } else {
            console.log("❌ No valid codes found after filtering");
            // Clear buffer if no valid codes
            setDetectionBuffer([]);
          }
        } else {
          console.log("❌ No 6-character codes found in cleaned text:", cleanText);
          // Clear buffer if no codes detected
          setDetectionBuffer([]);
        }
        
        setOcrActivity(false);

      } catch (err) {
        console.error("OCR scanning error:", err);
        setOcrActivity(false);
        setDetectionBuffer([]); // Clear buffer on error
        
        // If OCR fails repeatedly, try to restart the worker
        if (err && err.message && err.message.includes("Worker")) {
          console.log("Worker error detected, may need to restart OCR");
        }
      }
    }, 1500); // Slightly slower interval for better iOS performance
    
    console.log("✅ OCR scanning interval set up successfully");
  };

  // Cleanup OCR resources
  const cleanupOCR = async () => {
    try {
      console.log("Cleaning up OCR resources...");

      // Stop scanning interval
      if (ocrScanIntervalRef.current) {
        clearInterval(ocrScanIntervalRef.current);
        ocrScanIntervalRef.current = null;
      }

      // Stop video stream properly for iOS
      if (ocrStream) {
        console.log("Stopping video stream tracks...");
        ocrStream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}, state: ${track.readyState}`);
          track.stop();
        });
        setOcrStream(null);
      }

      // Clean video element properly for iOS
      if (ocrVideoRef.current) {
        const video = ocrVideoRef.current;
        console.log("Cleaning video element...");
        
        // Pause and reset video
        video.pause();
        video.srcObject = null;
        video.src = "";
        video.load(); // Force reset
        
        // Remove all event listeners to prevent memory leaks
        video.removeAttribute('src');
      }

      // Terminate Tesseract worker
      if (ocrWorker) {
        console.log("Terminating Tesseract worker...");
        await ocrWorker.terminate();
        setOcrWorker(null);
      }

      console.log("OCR cleanup completed");
    } catch (err) {
      console.error("Error during OCR cleanup:", err);
    }
  };

  // Cleanup Scandit resources
  const cleanupScandit = async () => {
    try {
      console.log("Cleaning up Scandit resources...");
 
      if (captureRef.current) {
        await captureRef.current.setEnabled(false);
        captureRef.current = null;
      }
 
      if (contextRef.current) {
        try {
          // Attempt to turn the camera off before disposing context
          const core = await import(/* @vite-ignore */ "@scandit/web-datacapture-core");
          if (core?.Camera?.default) {
            console.log("Switching Scandit camera to OFF state");
            await core.Camera.default.switchToDesiredState(core.FrameSourceState.Off);
          }
        } catch (camStopErr) {
          console.warn("Failed to switch Scandit camera off", camStopErr);
        }
 
        await contextRef.current.dispose();
        contextRef.current = null;
      }
 
      console.log("Scandit cleanup completed");
    } catch (err) {
      console.error("Error during Scandit cleanup:", err);
    }
  };

  // Function to switch between scanner modes
  const switchScannerMode = useCallback(async (mode: 'qr' | 'ocr') => {
    try {
      console.log(`Switching to ${mode} mode...`);
      
      // Prevent switching while already initializing
      if (isOcrInitializing) {
        console.log("Cannot switch modes while OCR is initializing");
        return;
      }
      
      // Reset any current state
      setError(null);
      setResult(null);
      setShowNotification(false);
      setIsValidating(false);
      
      // Reset OCR debug state
      setOcrActivity(false);
      setLastDetectedText("");
      setScanCount(0);

      if (mode === 'qr') {
        // Switching to QR mode - cleanup OCR and initialize Scandit
        setStatusMessage("جارٍ التبديل إلى وضع QR...");
        setScannerMode(mode);
        
        await cleanupOCR();
        
        // Reinitialize Scandit (this will be done in the useEffect)
        setLicenseStatus(null);
        setStatusMessage("جارٍ البحث عن رمز QR...");
        
      } else {
        // Switching to OCR mode - cleanup Scandit and initialize OCR
        setStatusMessage("جارٍ التبديل إلى وضع النص...");
        setScannerMode(mode);
        
        await cleanupScandit();
        
        // Give the browser a short moment to fully release the previous
        // camera stream before requesting a new one (especially Safari/iOS)
        await new Promise(res => setTimeout(res, 750));
        
        // Initialize OCR
        await initializeOCR();
      }
      
      triggerHapticFeedback([50]);
    } catch (err) {
      console.error("Error switching scanner mode:", err);
      setError("فشل التبديل بين أوضاع المسح. يرجى تحديث الصفحة.");
      // If an error occurs during switching, revert to QR mode
      setScannerMode('qr');
    }
  }, [isOcrInitializing]); // Add dependency on isOcrInitializing

  useEffect(() => {
    document.title = "مسح متقدم | برنامج مكافآت بريق";

    // Only initialize Scandit if we're in QR mode
    if (scannerMode !== 'qr') {
      return;
    }

    let dispose: (() => Promise<void>) | undefined;

    (async () => {
      try {
        /* Dynamically import the three SDK packages loaded via the CDN */
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
            preloadEngine: true,
            engineLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/build",
            errorListener: {
              onError: (error: any) => {
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
        
        setLicenseStatus('initialized');

        const createProtectedElement = (operation: Function) => {
          try {
            return operation();
          } catch (err) {
            console.warn("Protected element operation failed:", err);
            
            let arabicError = "خطأ أثناء تهيئة الماسح الضوئي";
            if (err && typeof err === 'object') {
              const errMsg = err.toString();
              if (errMsg.includes("camera") || errMsg.includes("Camera")) {
                arabicError = "تعذر الوصول إلى الكاميرا. يرجى التأكد من السماح بالوصول.";
              } else if (errMsg.includes("permission")) {
                arabicError = "تم رفض أذونات الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.";
              }
            }
            
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
        
        contextRef.current = context;
        
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
        
        const cameraSettings = new CameraSettings();
        cameraSettings.preferredResolution = VideoResolution.Auto;
        cameraSettings.zoomFactor = 1.3;
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
        const settings = new BarcodeCaptureSettings();
        settings.enableSymbologies([Symbology.QR]);
        
        const qrSettings = settings.settingsForSymbology(Symbology.QR);
        qrSettings.isColorInvertedEnabled = true;
        
        console.log("QR Code settings:", {
          colorInverted: qrSettings.isColorInvertedEnabled,
          symbology: "QR"
        });
        
        const width = new NumberWithUnit(0.8, MeasureUnit.Fraction);
        const heightToWidth = 1;
        const locationSelection = RectangularLocationSelection.withWidthAndAspectRatio(
          width, heightToWidth
        );
        settings.locationSelection = locationSelection;
        
        try {
          if (typeof barcode.ScanIntention === 'object' && barcode.ScanIntention?.Smart) {
            settings.scanIntention = barcode.ScanIntention.Smart;
          } else if (typeof core.ScanIntention === 'object' && core.ScanIntention?.Smart) {
            settings.scanIntention = core.ScanIntention.Smart;
          } else if (typeof settings.setProperty === 'function') {
            settings.setProperty("barcodeCapture.scanIntention", "smart");
          } else {
            console.log("ScanIntention not available in API, skipping this optimization");
          }
        } catch (settingsError) {
          console.warn("Error setting scan intention:", settingsError);
        }
        
        settings.setProperty("barcodeCapture.codeDuplicateFilter", 500);

        const capture = await BarcodeCapture.forContext(context, settings);
        captureRef.current = capture;
        
        capture.addListener({
          didScan: async (_mode: any, session: any) => {
            const code = session.newlyRecognizedBarcode;
            if (!code) return;
            
            await capture.setEnabled(false);
            
            const url = code.data;
            console.log("QR code detected:", url);
            
            await validateQrCode(url);
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
        
        let arabicErrorMessage = "فشل إعداد الماسح";
        
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
        
        setNotificationType('error');
        setShowNotification(true);
        
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
      }
    })();

    const originalAlert = window.alert;
    window.alert = function(message) {
      console.log("Alert intercepted:", message);
      
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
      
      setError(arabicMessage);
      setNotificationType('error');
      setShowNotification(true);
      
      return;
    };

    return () => {
      window.alert = originalAlert;
      if (dispose) dispose().catch(console.error);
    };
  }, [scannerMode]); // Re-run when scanner mode changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupOCR();
      cleanupScandit();
    };
  }, []);

  // Update video state for debugging
  const updateVideoState = useCallback(() => {
    if (ocrVideoRef.current) {
      const video = ocrVideoRef.current;
      setVideoState({
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration || 0,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        hasStream: !!video.srcObject
      });
    }
  }, []);

  // Monitor video state changes for debugging
  useEffect(() => {
    if (scannerMode === 'ocr' && ocrVideoRef.current) {
      const video = ocrVideoRef.current;
      const events = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing', 'pause', 'timeupdate'];
      
      const handleVideoEvent = (event: Event) => {
        console.log(`Video event: ${event.type}, readyState: ${video.readyState}, paused: ${video.paused}`);
        updateVideoState();
      };
      
      events.forEach(eventName => {
        video.addEventListener(eventName, handleVideoEvent);
      });
      
      // Initial state update
      updateVideoState();
      
      return () => {
        events.forEach(eventName => {
          video.removeEventListener(eventName, handleVideoEvent);
        });
      };
    }
  }, [scannerMode, updateVideoState]);

  // If we land directly in OCR mode, kick off initialization
  useEffect(() => {
    if (scannerMode === 'ocr' && !ocrWorker && !isOcrInitializing) {
      initializeOCR();
    }
  }, [scannerMode, ocrWorker, isOcrInitializing]);

  return (
    <InstallerLayout activeTab="advanced-scan">
      {/* Responsive grid layout container */}
      <div className="grid h-[calc(100dvh-4.5rem)] grid-rows-[auto_1fr] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-white shadow-sm z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">المسح المتقدم (Scandit + Tesseract)</h1>
            
            {/* License Status Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xs">الحالة:</span>
              <div className={`h-2.5 w-2.5 rounded-full ${
                (scannerMode === 'qr' && licenseStatus === 'initialized') || (scannerMode === 'ocr' && ocrWorker) ? 'bg-green-500' : 
                (scannerMode === 'qr' && licenseStatus === 'failed') ? 'bg-red-500' : 
                (scannerMode === 'ocr' && isOcrInitializing) ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'
              }`}></div>
              <span className="text-xs">
                {scannerMode === 'qr' ? (
                  licenseStatus === 'initialized' ? 'مفعّل' : 
                  licenseStatus === 'failed' ? 'فشل التفعيل' : 'جاري التحميل...'
                ) : (
                  ocrWorker ? 'جاهز' :
                  isOcrInitializing ? 'جاري التهيئة...' : 'غير مفعّل'
                )}
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
                    <span className="text-xs">وضع OCR</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Scanner Mode Status Message */}
          {((scannerMode === 'qr' && licenseStatus === 'initialized') || (scannerMode === 'ocr' && (ocrWorker || isOcrInitializing))) && (
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
          {/* Scandit QR Scanner */}
          <div
            ref={scannerRef}
            className={`absolute inset-0 bg-black overflow-hidden transition-opacity duration-300 ${
              scannerMode === 'qr' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="مساحة مسح رمز الاستجابة السريعة"
          />
          
          {/* Tesseract OCR Scanner */}
          <div className={`absolute inset-0 bg-black overflow-hidden transition-opacity duration-300 ${
            scannerMode === 'ocr' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            <video
              ref={ocrVideoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              controls={false}
              preload="metadata"
              webkit-playsinline="true"
              x-webkit-airplay="deny"
            />
            <canvas
              ref={ocrCanvasRef}
              className="hidden"
            />
            
            {/* Debug ROI overlay - shows actual scanning area */}
            {scannerMode === 'ocr' && roiDebugInfo && (
              <div 
                className="absolute border-2 border-red-500 pointer-events-none"
                style={{
                  width: '60%',
                  height: '30%',
                  left: '20%',
                  top: '35%',
                }}
              >
                <div className="absolute -top-6 left-0 text-xs text-red-500 font-mono bg-black/80 px-1">
                  Actual ROI (should match green box)
                </div>
              </div>
            )}
            
            {/* Real-time OCR Recognition Overlay - always show */}
            {scannerMode === 'ocr' && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pointer-events-none">
                <div className="text-white space-y-2">
                  {/* Always show scanning status */}
                  <div className="text-center">
                    <div className="text-xs text-gray-300 mb-1">
                      {ocrActivity ? 'جاري المسح...' : 'في انتظار النص...'}
                    </div>
                    {lastDetectedText ? (
                      <div className="bg-black/60 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">النص المكتشف:</div>
                        <div className="text-sm font-mono text-blue-300 break-all">
                          {lastDetectedText.substring(0, 150)}{lastDetectedText.length > 150 ? '...' : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        لم يتم اكتشاف أي نص بعد
                      </div>
                    )}
                  </div>
                  
                  {/* Show extracted codes if any */}
                  {lastDetectedText && (() => {
                    const cleanText = lastDetectedText.replace(/[^A-Za-z0-9\s]/g, '').toUpperCase();
                    const codeRegex = /\b[A-Z0-9]{6}\b/g;
                    const matches = cleanText.match(codeRegex);
                    if (matches && matches.length > 0) {
                      return (
                        <div className="border-t border-white/20 pt-2">
                          <div className="text-xs text-gray-400 mb-1">الرموز المستخرجة:</div>
                          <div className="flex gap-2 flex-wrap justify-center">
                            {matches.map((code, idx) => {
                              const isValid = isValidProductCode(code);
                              return (
                                <span 
                                  key={idx} 
                                  className={`font-mono text-sm px-3 py-1 rounded ${
                                    isValid ? 'bg-green-500/30 text-green-300 border border-green-500/50' : 'bg-red-500/30 text-red-300 border border-red-500/50'
                                  }`}
                                >
                                  {code}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}
          </div>
          
          {/* Scanner overlay - changes based on scanner mode */}
          <div className="absolute inset-0">
            {/* This part is pointer-events-none so overlay elements don't block the scanner */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {scannerMode === 'qr' ? (
                /* QR Mode - square guide */
                <div className="relative w-[min(80vw,80vh)] max-w-md aspect-square">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-scanline"></div>
                  <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-md"></div>
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary"></div>
                </div>
              ) : (
                /* OCR Mode - rectangle for text scanning with ROI indicator */
                <div className="relative">
                  {/* Semi-transparent overlay for areas outside ROI */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/40"></div>
                    {/* Clear ROI area */}
                    <div 
                      className="absolute bg-transparent"
                      style={{
                        width: '60%',
                        height: '30%',
                        top: '35%',
                        left: '20%',
                      }}
                    ></div>
                  </div>
                  
                  {/* ROI frame with debug mode enhancements */}
                  <div 
                    className="relative border-2 border-amber-500 rounded-md flex items-center justify-center"
                    style={{
                      width: '60vw',
                      maxWidth: '400px',
                      height: '120px',
                    }}
                  >
                    {/* Scanning animation */}
                    <div 
                      className="absolute h-full w-1 bg-gradient-to-b from-transparent via-amber-500 to-transparent" 
                      style={{
                        animation: 'pulse-slide 2s infinite ease-in-out',
                        left: 0
                      }}
                    ></div>
                    
                    {/* Corner markers for ROI - always show */}
                    <>
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400"></div>
                      
                      {/* ROI label */}
                      <div className="absolute -top-6 left-0 text-xs text-green-400 font-mono">
                        ROI: 60% × 30%
                      </div>
                    </>
                    
                    <div className="text-amber-500 text-sm font-medium px-4 text-center">
                      <div>ضع الرمز في وسط الإطار</div>
                      <div className="text-xs opacity-70 mt-1">رمز من ٦ أحرف وأرقام</div>
                      {detectionBuffer.length > 0 && (
                        <div className="text-xs text-green-400 mt-1">
                          جاري التحقق... ({detectionBuffer.length}/{DETECTION_BUFFER_SIZE})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Scanning instruction message - changes based on mode */}
            <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-black/70 backdrop-blur-sm text-white rounded-full px-6 py-3 text-sm">
                {scannerMode === 'qr' 
                  ? 'وجه الكاميرا نحو رمز QR الخاص بالمنتج'
                  : 'وجه الكاميرا نحو الرمز المطبوع المكون من ٦ أحرف'
                }
              </div>
            </div>
            
            {/* Mode toggle buttons - control panel in top right - this needs pointer events to work! */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              {/* OCR Debug Panel - always show in OCR mode */}
              {scannerMode === 'ocr' && (
                <div className="bg-black/80 backdrop-blur-sm text-white rounded-lg p-3 text-xs max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-2 w-2 rounded-full ${ocrActivity ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className="font-medium">OCR Debug</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={ocrActivity ? 'text-green-400' : 'text-gray-400'}>
                        {ocrActivity ? 'Scanning...' : 'Idle'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Scans:</span>
                      <span>{scanCount}</span>
                    </div>
                    
                    {/* Always show last detected text */}
                    <div className="border-t border-white/20 pt-1 mt-2">
                      <div className="font-medium mb-1">Last OCR Result:</div>
                      {lastDetectedText ? (
                        <div className="bg-black/40 p-2 rounded max-h-32 overflow-y-auto">
                          <div className="text-blue-300 text-xs font-mono break-all">
                            "{lastDetectedText}"
                          </div>
                          <div className="text-gray-400 text-xs mt-1">
                            Length: {lastDetectedText.length} chars
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs">No text detected yet</div>
                      )}
                    </div>
                    
                    {/* Detection Buffer Status */}
                    {detectionBuffer.length > 0 && (
                      <div className="border-t border-white/20 pt-1 mt-2">
                        <div className="font-medium text-green-400">Detection Buffer:</div>
                        <div className="text-yellow-300">
                          {detectionBuffer.join(', ')} ({detectionBuffer.length}/{DETECTION_BUFFER_SIZE})
                        </div>
                      </div>
                    )}
                    
                    {/* Last Detected Raw Text */}
                    {lastDetectedText && (
                      <div className="border-t border-white/20 pt-1 mt-2">
                        <div className="font-medium">Raw OCR Text:</div>
                        <div className="text-blue-300 text-xs break-all max-h-24 overflow-y-auto bg-black/40 p-1 rounded mt-1">
                          {lastDetectedText}
                        </div>
                      </div>
                    )}
                    
                    {/* Extracted Codes */}
                    {lastDetectedText && (
                      <div className="border-t border-white/20 pt-1 mt-2">
                        <div className="font-medium">Extracted Codes:</div>
                        <div className="text-xs mt-1">
                          {(() => {
                            const cleanText = lastDetectedText.replace(/[^A-Za-z0-9\s]/g, '').toUpperCase();
                            const codeRegex = /\b[A-Z0-9]{6}\b/g;
                            const matches = cleanText.match(codeRegex);
                            if (matches && matches.length > 0) {
                              return matches.map((code, idx) => (
                                <div key={idx} className={`${isValidProductCode(code) ? 'text-green-400' : 'text-red-400'}`}>
                                  {code} {isValidProductCode(code) ? '✓' : '✗'}
                                </div>
                              ));
                            } else {
                              return <span className="text-gray-400">No 6-char codes found</span>;
                            }
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Last Validated Code */}
                    {lastValidatedCode && (
                      <div className="border-t border-white/20 pt-1 mt-2">
                        <div className="font-medium">Last Validated:</div>
                        <div className="text-green-400">{lastValidatedCode}</div>
                        {validationCooldown && (
                          <div className="text-yellow-300 text-xs">Cooldown active</div>
                        )}
                      </div>
                    )}
                    
                    {/* ROI Debug Info */}
                    {roiDebugInfo && (
                      <div className="border-t border-white/20 pt-1 mt-2">
                        <div className="font-medium text-yellow-400">ROI Debug:</div>
                        <div className="text-xs space-y-0.5">
                          <div>Video: {roiDebugInfo.videoWidth}×{roiDebugInfo.videoHeight}</div>
                          <div>Container: {roiDebugInfo.containerWidth}×{roiDebugInfo.containerHeight}</div>
                          <div>ROI: {roiDebugInfo.roiWidth}×{roiDebugInfo.roiHeight}</div>
                          <div>Position: ({roiDebugInfo.roiX}, {roiDebugInfo.roiY})</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <Button
                onClick={() => switchScannerMode(scannerMode === 'qr' ? 'ocr' : 'qr')}
                className={`rounded-full shadow-lg ${scannerMode === 'qr' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90'}`}
                size="sm"
                disabled={isOcrInitializing || isValidating}
              >
                {isOcrInitializing ? (
                  <span className="flex items-center gap-1 text-white">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري التهيئة...</span>
                  </span>
                ) : (
                  scannerMode === 'qr' ? (
                    <span className="flex items-center gap-1 text-white">
                      <TextCursorInput className="h-4 w-4" />
                      <span>تبديل إلى وضع النص</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-white">
                      <QrCode className="h-4 w-4" />
                      <span>تبديل إلى وضع QR</span>
                    </span>
                  )
                )}
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
          {licenseStatus === 'failed' && scannerMode === 'qr' && (
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