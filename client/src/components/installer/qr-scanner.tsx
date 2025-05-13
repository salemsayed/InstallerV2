import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Camera, CheckCircle2, List, Loader2, QrCode, RefreshCw, 
  ToggleLeft, ToggleRight, X, XCircle, Scan 
} from "lucide-react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useAuth } from "@/hooks/auth-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

interface ScanHistoryItem {
  productName: string;
  timestamp: Date;
  points: number;
  status: 'success' | 'error';
  message?: string;
}

// QR code tracker for managing cooldown and tracking codes within a scanner session
class QrCodeTracker {
  // Temporary cooldown for UI feedback
  private cooldownCodes: Map<string, number> = new Map();
  // Tracking of processed codes (in this session only)
  private processedCodes: Set<string> = new Set();
  private readonly cooldownPeriod: number; // milliseconds
  
  constructor(cooldownPeriod: number = 3000) { // 3 seconds default cooldown
    this.cooldownPeriod = cooldownPeriod;
  }
  
  // Check if code can be processed (not in cooldown)
  canProcessCode(qrCode: string): boolean {
    const now = Date.now();
    const lastScanTime = this.cooldownCodes.get(qrCode);
    
    // Check cooldown first
    if (lastScanTime && (now - lastScanTime) < this.cooldownPeriod) {
      // Code is still in cooldown period
      return false;
    }
    
    // Not in cooldown, and not processed before
    return !this.processedCodes.has(qrCode);
  }
  
  // Mark a code as processed (will add to cooldown and permanent tracking)
  markProcessed(qrCode: string): void {
    this.cooldownCodes.set(qrCode, Date.now());
    this.processedCodes.add(qrCode);
    this.cleanup(Date.now());
  }
  
  // Check if a code was already processed
  isProcessed(qrCode: string): boolean {
    return this.processedCodes.has(qrCode);
  }
  
  // Get count of processed codes
  getProcessedCount(): number {
    return this.processedCodes.size;
  }
  
  // Clean up old entries from the cooldown map
  private cleanup(now: number) {
    for (const [code, timestamp] of this.cooldownCodes.entries()) {
      if (now - timestamp > this.cooldownPeriod) {
        this.cooldownCodes.delete(code);
      }
    }
  }
  
  // Reset cooldown only (but keep track of processed codes)
  resetCooldown() {
    this.cooldownCodes.clear();
  }
  
  // Reset everything (all cooldowns and processed codes)
  fullReset() {
    this.cooldownCodes.clear();
    this.processedCodes.clear();
  }
}

interface QrScannerProps {
  onScanSuccess?: (productName: string) => void;
}

export default function QrScanner({ onScanSuccess }: QrScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [totalPointsInSession, setTotalPointsInSession] = useState(0);
  const [totalScansInSession, setTotalScansInSession] = useState(0);
  const [successfulScansInSession, setSuccessfulScansInSession] = useState(0);
  const [processedCodesCount, setProcessedCodesCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const audioSuccessRef = useRef<HTMLAudioElement | null>(null);
  const audioErrorRef = useRef<HTMLAudioElement | null>(null);
  const qrTrackerRef = useRef<QrCodeTracker>(new QrCodeTracker(3000)); // 3 seconds cooldown
  
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  // Cleanup scanner on component unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(error => console.error("Error stopping scanner:", error));
      }
    };
  }, []);

  // Reset session counters when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // We keep the history but reset the session counters when dialog is closed
      if (totalScansInSession > 0) {
        // Only reset if there were scans in the session
        setTotalPointsInSession(0);
        setTotalScansInSession(0);
        setSuccessfulScansInSession(0);
      }
    }
  }, [isOpen, totalScansInSession]);
  
  // iOS-specific scanner fixes to handle rendering issues
  useEffect(() => {
    if (isScanning) {
      // Use a delay to ensure elements are rendered
      const timeout = setTimeout(() => {
        // Check if we're on an iOS device
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (!isIOS) return;
        
        console.log("SCANNER_DEBUG: Applying iOS-specific fixes to QR scanner");
        
        // Force outer container dimensions - more modest height to not break modal layout
        const outerContainer = document.querySelector('div.rounded-lg.border');
        if (outerContainer) {
          // Use a more reasonable height that won't break the dialog
          (outerContainer as HTMLElement).style.height = '200px';
          (outerContainer as HTMLElement).style.minHeight = '200px';
          console.log("SCANNER_DEBUG: Forced outer container height for iOS");
        }
        
        // Fix QR reader container
        const qrContainer = document.getElementById('qr-reader');
        if (qrContainer) {
          qrContainer.style.height = '100%';
          // Match the height of the outer container
          qrContainer.style.minHeight = '200px';
          console.log("SCANNER_DEBUG: Applied styles to qr-reader container");
          
          // 1. Fix the scanning region (QR box)
          const scanBoxElement = qrContainer.querySelector('#qr-shaded-region');
          if (scanBoxElement) {
            // Use a more subtle shadow that won't completely obscure the UI
            (scanBoxElement as HTMLElement).style.boxShadow = '0 0 0 99999px rgba(0, 0, 0, 0.3)';
            (scanBoxElement as HTMLElement).style.border = '2px solid #fff';
            console.log("SCANNER_DEBUG: Enhanced QR scan box styles");
          }
          
          // 2. Style the video element
          const videoElement = qrContainer.querySelector('video');
          if (videoElement) {
            (videoElement as HTMLElement).style.objectFit = 'cover';
            (videoElement as HTMLElement).style.width = '100%';
            (videoElement as HTMLElement).style.height = '100%';
            console.log("SCANNER_DEBUG: Enhanced video element styles");
          }
        }
        
        // Log the dimensions after our fixes
        if (outerContainer && qrContainer) {
          console.log(`SCANNER_DEBUG: After iOS fixes - Outer: ${(outerContainer as HTMLElement).clientWidth}x${(outerContainer as HTMLElement).clientHeight}, Inner: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
        }
      }, 1000); // Shorter delay so ui fixes apply faster
      
      return () => clearTimeout(timeout);
    }
  }, [isScanning]);

  // Play success sound
  const playSuccessSound = () => {
    if (audioSuccessRef.current) {
      audioSuccessRef.current.currentTime = 0;
      audioSuccessRef.current.play().catch(e => console.error("Error playing success sound:", e));
    }
  };

  // Play error sound
  const playErrorSound = () => {
    if (audioErrorRef.current) {
      audioErrorRef.current.currentTime = 0;
      audioErrorRef.current.play().catch(e => console.error("Error playing error sound:", e));
    }
  };

  const startScanner = async () => {
    console.log("SCANNER_DEBUG: Starting QR scanner");
    const deviceType = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 
      (/iPad/.test(navigator.userAgent) ? "iPad" : "iPhone") : 
      "Other device";
    console.log(`SCANNER_DEBUG: Device detected: ${deviceType}, User Agent: ${navigator.userAgent}`);
    
    setIsScanning(true);
    setError(null);

    // Use setTimeout to ensure state updates have been applied
    setTimeout(() => {
      // Get both outer container and inner QR container
      const outerContainer = document.querySelector('div.rounded-lg.border');
      const qrCodeId = "qr-reader";
      const qrContainer = document.getElementById(qrCodeId);
      
      if (!qrContainer) {
        console.error("SCANNER_DEBUG: QR container not found");
        setError("QR scanner element not found (ERROR_CODE: ELEMENT_NOT_FOUND)");
        setIsScanning(false);
        return;
      }
      
      console.log(`SCANNER_DEBUG: Outer container dimensions: ${outerContainer?.clientWidth}x${outerContainer?.clientHeight}`);
      console.log(`SCANNER_DEBUG: QR container found with dimensions: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
      
      // Force proper dimensions for iOS devices before initializing scanner
      if (deviceType === "iPhone" || deviceType === "iPad") {
        if (qrContainer.clientHeight < 50) {
          console.log("SCANNER_DEBUG: Forcing container height for iOS device");
          // Force height for iOS devices that might not render the container properly
          const parentElement = qrContainer.parentElement;
          if (parentElement) {
            // Use a smaller height that won't break the modal layout
            parentElement.style.height = "180px";
            parentElement.style.minHeight = "180px";
          }
          qrContainer.style.height = "180px";
          qrContainer.style.minHeight = "180px";
          // Log the new dimensions after forcing height
          console.log(`SCANNER_DEBUG: Updated container dimensions: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
        }
      }
      
      // Also fix the dialog content to ensure everything is visible
      const dialogContent = document.querySelector('[role="dialog"]');
      if (dialogContent) {
        (dialogContent as HTMLElement).style.maxHeight = '90vh';
        (dialogContent as HTMLElement).style.overflow = 'auto';
      }

      html5QrcodeRef.current = new Html5Qrcode(qrCodeId);
      console.log("SCANNER_DEBUG: Html5Qrcode instance created");
      
      // Continue with starting the camera
      initializeCamera(deviceType);
    }, 200); // Short delay to ensure DOM updates
  };
  
  const initializeCamera = async (deviceType: string) => {
    // Set lower FPS for iPhone to improve performance
    const scannerFps = deviceType === "iPhone" ? 5 : 10;
    
    try {
      console.log(`SCANNER_DEBUG: Starting camera with environment facing mode, FPS: ${scannerFps}`);
      const startTime = performance.now();
      
      // Create optimized configuration for iOS devices
      const isIOS = deviceType === "iPhone" || deviceType === "iPad";
      const cameraConfig = { 
        facingMode: "environment" 
      };
      
      // iOS-specific optimizations
      const scannerConfig = {
        fps: scannerFps,
        qrbox: isIOS ? { width: 200, height: 200 } : { width: 250, height: 250 },
        aspectRatio: isIOS ? 1.5 : 1.0, // Different aspect ratio for iOS
      };
      
      console.log(`SCANNER_DEBUG: Using scanner config:`, JSON.stringify(scannerConfig));
      
      // Ensure html5QrcodeRef.current is not null before proceeding
      if (!html5QrcodeRef.current) {
        console.error("SCANNER_DEBUG: Scanner instance is null, cannot start camera");
        setError("Scanner initialization failed (ERROR_CODE: SCANNER_NULL)");
        setIsScanning(false);
        return;
      }
      
      await html5QrcodeRef.current.start(
        cameraConfig,
        scannerConfig,
        handleScanSuccess,
        (errorMessage) => {
          // Don't show QR scanning errors to users, as they are not useful
          // Filter out common "No QR code found" errors to reduce console noise
          if (!errorMessage.toString().includes("NotFoundException")) {
            console.log(`SCANNER_DEBUG: Error from scanner: ${errorMessage}`);
          }
        }
      );
      
      const endTime = performance.now();
      console.log(`SCANNER_DEBUG: Camera started in ${endTime - startTime}ms`);
      
      // Try to log camera permission status - use try/catch to handle different browser supports
      try {
        console.log("SCANNER_DEBUG: Checking camera permission status");
      } catch (error) {
        console.log("SCANNER_DEBUG: Error checking camera permission:", error);
      };
      
    } catch (err) {
      console.error("SCANNER_DEBUG: Error starting scanner:", err);
      setError("Failed to start camera. Please grant camera permission. (ERROR_CODE: CAMERA_PERMISSION)");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      await html5QrcodeRef.current.stop();
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    const scanTime = new Date().toISOString();
    console.log(`SCANNER_DEBUG: [${scanTime}] QR code detected: ${decodedText.substring(0, 30)}...`);
    
    // Performance tracking
    const startTime = performance.now();
    
    // Always set the last scanned code
    setLastScannedCode(decodedText);
    
    // First check if it's already been fully processed (validated and saved)
    if (qrTrackerRef.current.isProcessed(decodedText)) {
      console.log(`SCANNER_DEBUG: QR code already processed (time since start: ${performance.now() - startTime}ms)`);
      // Show visual feedback for already processed code
      setCooldownActive(true);
      
      // Add to scan history for already processed codes
      addToScanHistory({
        productName: "Already Processed",
        timestamp: new Date(),
        points: 0,
        status: 'error',
        message: "تم مسح هذا الكود مسبقاً"
      });
      
      // Keep the cooldown indicator visible longer for better UX
      // This won't cause jittering since we moved it to a fixed-height container
      setTimeout(() => {
        setCooldownActive(false);
        console.log(`SCANNER_DEBUG: Cooldown reset after already processed code (time: ${performance.now() - startTime}ms)`);
      }, 2000);
      
      // Play error sound for feedback
      playErrorSound();
      
      return;
    }
    
    // Then check if it's in cooldown period
    if (!qrTrackerRef.current.canProcessCode(decodedText)) {
      console.log(`SCANNER_DEBUG: QR code in cooldown (time since start: ${performance.now() - startTime}ms)`);
      // Show visual feedback for cooldown
      setCooldownActive(true);
      
      // Keep the cooldown indicator visible for 1.5 seconds
      setTimeout(() => {
        setCooldownActive(false);
        console.log(`SCANNER_DEBUG: Cooldown reset (time: ${performance.now() - startTime}ms)`);
      }, 1500);
      
      // Play error sound for feedback
      playErrorSound();
      
      return;
    }
    
    // If not in batch mode, stop the scanner while validating
    if (!batchMode) {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        await stopScanner();
      }
    }
    
    // On iOS, we need to keep the camera open even in non-batch mode to avoid re-initialization issues
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !batchMode) {
      // Don't actually stop the scanner on iOS
      setIsScanning(false);
    }
    
    // Stage 1: Simple validations
    // Validate UUID format (simple local check)
    if (!isValidUUIDv4(decodedText)) {
      console.log(`SCANNER_DEBUG: Invalid UUID format (time since start: ${performance.now() - startTime}ms)`);
      setError("Invalid QR code format. Please scan a valid QR code. (ERROR_CODE: INVALID_FORMAT)");
      
      addToScanHistory({
        productName: "Invalid Format",
        timestamp: new Date(),
        points: 0,
        status: 'error',
        message: "تنسيق غير صالح"
      });
      
      playErrorSound();
      return;
    }
    
    // Add to cooldown tracking
    qrTrackerRef.current.markProcessed(decodedText);
    setProcessedCodesCount(qrTrackerRef.current.getProcessedCount());
    
    try {
      // Stage 2: Server-side validation
      console.log(`SCANNER_DEBUG: Starting server validation (time since start: ${performance.now() - startTime}ms)`);
      setIsValidating(true);
      
      // Call API to validate the QR code
      const response = await apiRequest("POST", "/api/scan-qr", { 
        uuid: decodedText,
        userId: user?.id
      });
      
      const result = await response.json();
      console.log(`SCANNER_DEBUG: Server validation complete (time since start: ${performance.now() - startTime}ms)`);
      
      if (result.success) {
        // Success: code was validated and points were awarded
        console.log(`SCANNER_DEBUG: Successful scan: ${result.points} points awarded for ${result.productName} (time since start: ${performance.now() - startTime}ms)`);
        
        // Play success sound
        playSuccessSound();
        
        // Show success toast
        toast({
          title: "تم التحقق بنجاح!",
          description: `تم إضافة ${result.points} نقطة لحسابك للمنتج "${result.productName}"`,
        });
        
        // Call success callback if provided
        if (onScanSuccess) {
          onScanSuccess(result.productName);
        }
        
        // Add to scan history
        addToScanHistory({
          productName: result.productName,
          timestamp: new Date(),
          points: result.points,
          status: 'success'
        });
        
        // Update session stats
        setTotalScansInSession(prev => prev + 1);
        setSuccessfulScansInSession(prev => prev + 1);
        setTotalPointsInSession(prev => prev + result.points);
        
        // Refresh user data to update points
        refreshUser();
      } else {
        // Error: code was not valid or already scanned
        console.log(`SCANNER_DEBUG: Scan error: ${result.message} (time since start: ${performance.now() - startTime}ms)`);
        
        // Play error sound
        playErrorSound();
        
        // Show error toast
        toast({
          title: "فشل التحقق",
          description: result.message,
          variant: "destructive",
        });
        
        // Add to scan history
        addToScanHistory({
          productName: result.productName || "Unknown Product",
          timestamp: new Date(),
          points: 0,
          status: 'error',
          message: result.message
        });
        
        // Update session stats (total only, not successful)
        setTotalScansInSession(prev => prev + 1);
      }
    } catch (error) {
      console.error("SCANNER_DEBUG: Error validating QR code:", error);
      
      // Play error sound
      playErrorSound();
      
      // Show error toast
      toast({
        title: "حدث خطأ",
        description: "حدث خطأ أثناء التحقق من الكود. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
      
      // Add to scan history
      addToScanHistory({
        productName: "Error",
        timestamp: new Date(),
        points: 0,
        status: 'error',
        message: "خطأ في الاتصال"
      });
    } finally {
      setIsValidating(false);
      
      // If we're in batch mode, reset cooldown to allow immediate scanning of another code
      if (batchMode) {
        setCooldownActive(false);
      }
      
      console.log(`SCANNER_DEBUG: Full scan process complete (time: ${performance.now() - startTime}ms)`);
    }
  };

  const addToScanHistory = (item: ScanHistoryItem) => {
    // Add to beginning of the array (most recent first)
    setScanHistory(prev => [item, ...prev].slice(0, 20)); // Keep only last 20 items
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    
    if (!open && html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      stopScanner();
    }
    
    // Reset states when dialog is closed
    if (!open) {
      setError(null);
      setIsScanning(false);
      setIsValidating(false);
      setShowHistory(false);
      
      // Reset all QR code tracking when dialog closes (as per requirements)
      qrTrackerRef.current.fullReset();
      setProcessedCodesCount(0);
      
      // Reset session stats
      setTotalScansInSession(0);
      setSuccessfulScansInSession(0);
      setTotalPointsInSession(0);
    } else {
      // Also reset when reopening the scanner
      qrTrackerRef.current.fullReset();
      setProcessedCodesCount(0);
    }
  };

  const toggleBatchMode = () => {
    // If turning off batch mode while scanning, stop scanner
    if (batchMode && isScanning && !isValidating) {
      stopScanner();
    }
    
    setBatchMode(!batchMode);
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
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
        <DialogContent className="sm:max-w-[425px] p-4 max-h-[85vh] overflow-auto" dir="rtl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-center font-bold text-lg">
              مسح رمز الاستجابة السريعة
            </DialogTitle>
          </DialogHeader>

          {/* Main Content */}
          <div className="space-y-3">
            {/* Controls Row */}
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={batchMode ? "default" : "outline"}
                size="sm" 
                onClick={toggleBatchMode}
                className="text-xs"
              >
                <Scan className="h-4 w-4 ml-1" />
                وضع المسح المتتابع
              </Button>
              
              <Button 
                variant={showHistory ? "default" : "outline"}
                size="sm" 
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs"
              >
                <List className="h-4 w-4 ml-1" />
                سجل المسح
              </Button>
            </div>
            
            {/* Session Stats */}
            {(totalScansInSession > 0 || batchMode) && (
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-center flex-1">
                  <div className="font-bold">{successfulScansInSession}</div>
                  <div>ناجح</div>
                </div>
                <div className="text-xs text-center flex-1">
                  <div className="font-bold">{totalScansInSession}</div>
                  <div>إجمالي</div>
                </div>
                <div className="text-xs text-center flex-1">
                  <div className="font-bold">{totalPointsInSession}</div>
                  <div>نقاط</div>
                </div>
              </div>
            )}
            
            {/* Processed Codes Counter */}
            {processedCodesCount > 0 && (
              <div className="flex items-center justify-between p-2 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 ml-1" />
                  <span className="text-xs">
                    <span className="font-bold">{processedCodesCount}</span> كود تم معالجته
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-6 p-0 px-1"
                  onClick={() => {
                    if (confirm('هل أنت متأكد من إعادة تعيين الأكواد التي تم مسحها في هذه الجلسة؟')) {
                      qrTrackerRef.current.fullReset();
                      setProcessedCodesCount(0);
                      toast({
                        title: "تم إعادة التعيين",
                        description: "تم إعادة تعيين الأكواد المسجلة في هذه الجلسة",
                      });
                    }
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Scan History */}
            {showHistory && (
              <div className="max-h-28 overflow-y-auto bg-slate-50 rounded-lg p-2">
                <h3 className="text-sm font-medium mb-1">آخر عمليات المسح</h3>
                
                {scanHistory.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-1">لا توجد عمليات مسح سابقة</p>
                ) : (
                  <div className="space-y-1">
                    {scanHistory.map((item, idx) => (
                      <div key={idx} className={`text-xs p-1.5 rounded-lg flex items-center justify-between ${
                        item.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        <div className="flex items-center">
                          {item.status === 'success' ? (
                            <CheckCircle2 className="h-3 w-3 ml-1" />
                          ) : (
                            <XCircle className="h-3 w-3 ml-1" />
                          )}
                          <span className="font-medium truncate max-w-[120px]">{item.productName}</span>
                        </div>
                        <div className="flex items-center">
                          {item.status === 'success' && (
                            <span className="bg-green-100 text-green-800 rounded-full px-1.5 py-0.5 mr-1 text-[10px]">
                              +{item.points}
                            </span>
                          )}
                          <span className="text-[10px] tabular-nums">{formatTime(item.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scanner Container */}
            <div className="relative my-1">
              {isValidating ? (
                <div className="rounded-lg border border-gray-200 bg-white p-6 flex flex-col items-center justify-center h-48">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                  <p className="text-center text-gray-600">جارٍ التحقق من الكود...</p>
                </div>
              ) : (
                <>
                  {isScanning ? (
                    <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-black relative" style={{ height: "200px" }}>
                      {/* Camera Feed */}
                      <div id="qr-reader" className="w-full h-full" style={{ minHeight: "200px" }}></div>
                      
                      {/* Scan Target Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border-2 border-white rounded-lg opacity-70"></div>
                      </div>
                      
                      {/* Instructions */}
                      <div className="absolute top-2 left-0 right-0 text-center">
                        <div className="bg-white/90 text-black px-2 py-1 rounded-md inline-block text-xs font-medium shadow-sm">
                          وجه الكاميرا نحو رمز QR
                        </div>
                      </div>
                      
                      {/* Cooldown Overlay */}
                      {cooldownActive && lastScannedCode && (
                        <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                          qrTrackerRef.current.isProcessed(lastScannedCode) 
                            ? 'bg-red-900/30' 
                            : 'bg-amber-900/30'
                        }`}>
                          {qrTrackerRef.current.isProcessed(lastScannedCode) ? (
                            <div className="bg-white/95 rounded-lg p-3 max-w-[80%] text-center shadow-md">
                              <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
                              <p className="text-red-600 font-bold text-sm">تم معالجة هذا الكود مسبقاً</p>
                              <p className="text-red-600 text-xs">لا يمكن مسح نفس الكود مرتين</p>
                            </div>
                          ) : (
                            <div className="bg-white/95 rounded-lg p-3 max-w-[80%] text-center shadow-md">
                              <Loader2 className="h-6 w-6 animate-spin text-amber-500 mx-auto mb-1" />
                              <p className="text-amber-600 font-bold text-sm">انتظر قليلاً</p>
                              <p className="text-amber-600 text-xs">يرجى الانتظار قبل مسح كود آخر</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 flex flex-col items-center justify-center h-48">
                      <QrCode className="h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-center text-gray-600 mb-4">قم بفتح الكاميرا لبدء المسح</p>
                      <Button onClick={startScanner} className="text-sm">
                        <Camera className="mr-2 h-4 w-4" />
                        فتح الكاميرا
                      </Button>
                    </div>
                  )}
                </>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="absolute inset-0 bg-red-50/95 rounded-lg border border-red-200 flex flex-col items-center justify-center p-4">
                  <XCircle className="h-8 w-8 text-red-500 mb-2" />
                  <p className="text-center text-sm text-red-700 mb-3">{error}</p>
                  <Button variant="outline" onClick={() => setError(null)}>
                    حاول مرة أخرى
                  </Button>
                </div>
              )}
            </div>
            
            {/* Camera Controls */}
            {isScanning && !isValidating && !error && (
              <Button onClick={stopScanner} variant="outline" className="w-full">
                <X className="mr-2 h-4 w-4" />
                إغلاق الكاميرا
              </Button>
            )}
          </div>
          
          {/* Hidden audio elements */}
          <audio ref={audioSuccessRef} preload="auto">
            <source src="/sounds/success.mp3" type="audio/mpeg" />
          </audio>
          <audio ref={audioErrorRef} preload="auto">
            <source src="/sounds/error.mp3" type="audio/mpeg" />
          </audio>
        </DialogContent>
      </Dialog>
    </>
  );
}