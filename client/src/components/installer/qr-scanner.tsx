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
    // Convert to array first to avoid iteration issues
    const entries = Array.from(this.cooldownCodes.entries());
    entries.forEach(([code, timestamp]) => {
      if (now - timestamp > this.cooldownPeriod) {
        this.cooldownCodes.delete(code);
      }
    });
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
  
  // Post-scanner initialization stylings for better camera visibility
  useEffect(() => {
    if (isScanning) {
      // Apply fixes after the scanner has had time to initialize its UI
      const timeout = setTimeout(() => {
        console.log("SCANNER_DEBUG: Applying post-initialization styling fixes");
        
        // Check if we're on an iOS device for specialized handling
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const deviceType = isIOS ? 
          (/iPad/.test(navigator.userAgent) ? "iPad" : "iPhone") : 
          "Other device";
        
        // Fix QR reader container to take maximum space
        const qrContainer = document.getElementById('qr-reader');
        if (qrContainer) {
          // Make container fill all available space
          qrContainer.style.position = 'absolute';
          qrContainer.style.inset = '0';
          qrContainer.style.width = '100%';
          qrContainer.style.height = '100%';
          console.log("SCANNER_DEBUG: Applied absolute positioning to QR container");
          
          // Find and style the video element for better visibility
          const videoElement = qrContainer.querySelector('video');
          if (videoElement) {
            // Make video fill the container
            (videoElement as HTMLElement).style.objectFit = 'cover';
            (videoElement as HTMLElement).style.width = '100%';
            (videoElement as HTMLElement).style.height = '100%';
            
            // For iPhone, add additional optimizations
            if (deviceType === "iPhone") {
              // Try to adjust video size for better visibility on small screens
              (videoElement as HTMLElement).style.objectPosition = 'center';
              console.log("SCANNER_DEBUG: Applied specialized video styling for iPhone");
            }
          }
          
          // Improve scan box visibility for all devices
          const scanBoxElement = qrContainer.querySelector('#qr-shaded-region');
          if (scanBoxElement) {
            // For iPhones, use more prominent scan box styling
            if (deviceType === "iPhone") {
              (scanBoxElement as HTMLElement).style.border = '4px solid white';
              (scanBoxElement as HTMLElement).style.boxShadow = '0 0 0 100vmax rgba(0, 0, 0, 0.6)';
            } else {
              // For other devices, use standard styling
              (scanBoxElement as HTMLElement).style.border = '3px solid white';
              (scanBoxElement as HTMLElement).style.boxShadow = '0 0 0 100vmax rgba(0, 0, 0, 0.5)';
            }
            console.log(`SCANNER_DEBUG: Enhanced scan box styling for ${deviceType}`);
          }
          
          // Get all scanner-created elements for logging
          const scannerElements = qrContainer.querySelectorAll('*');
          console.log(`SCANNER_DEBUG: Scanner has ${scannerElements.length} child elements`);
          
          // Log final dimensions
          console.log(`SCANNER_DEBUG: Final QR container dimensions: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
        } else {
          console.log("SCANNER_DEBUG: QR container not found for post-initialization styling");
        }
      }, 1500); // Longer delay to ensure HTML5QrCode has initialized all its UI elements
      
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
      const qrCodeId = "qr-reader";
      const qrContainer = document.getElementById(qrCodeId);
      
      if (!qrContainer) {
        console.error("SCANNER_DEBUG: QR container not found");
        setError("QR scanner element not found (ERROR_CODE: ELEMENT_NOT_FOUND)");
        setIsScanning(false);
        return;
      }
      
      console.log(`SCANNER_DEBUG: QR container found with dimensions: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
      
      // Get parent container dimensions for debugging
      const parentElement = qrContainer.parentElement;
      if (parentElement) {
        console.log(`SCANNER_DEBUG: Parent container dimensions: ${parentElement.clientWidth}x${parentElement.clientHeight}`);
      }
      
      // For iPhone, ensure we have enough height
      if (deviceType === "iPhone") {
        // Find the modal content container for better sizing
        const dialogContent = document.querySelector('[role="dialog"]');
        if (dialogContent) {
          // Ensure dialog takes up maximum allowed space
          (dialogContent as HTMLElement).style.maxHeight = '90vh';
          (dialogContent as HTMLElement).style.overflow = 'hidden'; // Use hidden to prevent scrollbars
          console.log(`SCANNER_DEBUG: Set dialog content to 90vh max height`);
        }
        
        // Set main container to take maximum available height
        if (parentElement) {
          parentElement.style.height = "100%"; 
          parentElement.style.maxHeight = "100%";
          console.log(`SCANNER_DEBUG: Set parent container to 100% height`);
        }
        
        // Make QR container fill available space
        qrContainer.style.height = "100%";
        qrContainer.style.width = "100%";
        qrContainer.style.position = "absolute"; // Use absolute positioning
        qrContainer.style.inset = "0"; // Fill the container
        console.log(`SCANNER_DEBUG: Applied absolute positioning to QR container`);
      }
      
      // Always ensure QR container has a minimum height
      if (qrContainer.clientHeight < 100) {
        console.log(`SCANNER_DEBUG: QR container height too small (${qrContainer.clientHeight}px), enforcing minimum`);
        qrContainer.style.minHeight = "300px";
      }

      // Initialize the scanner
      html5QrcodeRef.current = new Html5Qrcode(qrCodeId);
      console.log("SCANNER_DEBUG: Html5Qrcode instance created");
      
      // Add extra styles after scanner is created but before camera is started
      setTimeout(() => {
        // Find scanner-generated elements and improve their styling
        const scanBox = document.querySelector('#qr-shaded-region');
        if (scanBox) {
          (scanBox as HTMLElement).style.border = "3px solid white";
          (scanBox as HTMLElement).style.boxShadow = "0 0 0 100vmax rgba(0, 0, 0, 0.5)";
          console.log("SCANNER_DEBUG: Enhanced scan box styling");
        }
        
        // Continue with starting the camera
        initializeCamera(deviceType);
      }, 100);
    }, 200);
  };
  
  const initializeCamera = async (deviceType: string) => {
    // Set extremely low FPS for iPhone to prioritize reliability over responsiveness
    const scannerFps = deviceType === "iPhone" ? 3 : (deviceType === "iPad" ? 5 : 10);
    
    try {
      console.log(`SCANNER_DEBUG: Starting camera with environment facing mode, FPS: ${scannerFps}`);
      const startTime = performance.now();
      
      // Create optimized configuration for mobile devices
      const isIOS = deviceType === "iPhone" || deviceType === "iPad";
      const isSmallPhone = deviceType === "iPhone"; 
      
      const cameraConfig = { 
        facingMode: "environment" 
      };
      
      // Make scan box bigger for full-screen mode now that we have more space
      let qrDimension = 250;
      
      // For iPhone, keep a more modest scan box to ensure performance
      if (isSmallPhone) {
        qrDimension = 220;
      } else if (deviceType === "iPad") {
        qrDimension = 300;
      }
      
      // Optimize scanner configuration based on device
      const scannerConfig = {
        fps: scannerFps,
        qrbox: { width: qrDimension, height: qrDimension },
        aspectRatio: isIOS ? 1.33 : 1.0, // Optimized aspect ratio for iOS
        formatsToSupport: [0], // QR Code only to improve performance (0 = QR Code)
        disableFlip: true, // Disable mirroring to improve performance
      };
      
      console.log(`SCANNER_DEBUG: Using scanner config for ${deviceType}:`, JSON.stringify(scannerConfig));
      
      // Extra logging for container dimensions
      const qrContainer = document.getElementById('qr-reader');
      if (qrContainer) {
        console.log(`SCANNER_DEBUG: QR container dimensions before start: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
      }
      
      // Ensure scanner instance exists
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
          // Filter out common "No QR code found" errors to reduce console noise
          if (!errorMessage.toString().includes("NotFoundException")) {
            console.log(`SCANNER_DEBUG: Error from scanner: ${errorMessage}`);
          }
        }
      );
      
      const endTime = performance.now();
      console.log(`SCANNER_DEBUG: Camera started in ${endTime - startTime}ms`);
      
      // After camera is started, log dimensions again
      setTimeout(() => {
        const qrContainer = document.getElementById('qr-reader');
        if (qrContainer) {
          console.log(`SCANNER_DEBUG: QR container dimensions after start: ${qrContainer.clientWidth}x${qrContainer.clientHeight}`);
          
          // Manually check child elements
          const videoElement = qrContainer.querySelector('video');
          if (videoElement) {
            console.log(`SCANNER_DEBUG: Video element dimensions: ${(videoElement as HTMLElement).clientWidth}x${(videoElement as HTMLElement).clientHeight}`);
          }
        }
      }, 1000);
      
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
        <DialogContent className="sm:max-w-[425px] p-0 max-h-[90vh] overflow-hidden" dir="rtl">
          {/* FULLSCREEN CAMERA MODE - Optimized for mobile */}
          <div className="flex flex-col h-[80vh] max-h-[80vh]">
            {/* Camera Container - Takes maximum space */}
            <div className="flex-grow overflow-hidden relative">
              {isValidating ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-black/10">
                  <Loader2 className="h-16 w-16 animate-spin text-white mb-3" />
                  <p className="text-center text-white font-medium bg-black/30 px-3 py-1 rounded-full">
                    جارٍ التحقق من الكود...
                  </p>
                </div>
              ) : isScanning ? (
                <div className="w-full h-full relative bg-black">
                  {/* Camera Feed - FULLSCREEN */}
                  <div id="qr-reader" className="w-full h-full absolute inset-0"></div>
                  
                  {/* Scan Target - LARGE & CENTERED */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-white rounded-lg opacity-80"></div>
                  </div>
                  
                  {/* Status Bar - TOP */}
                  <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-2 bg-black/50">
                    <div className="flex items-center space-x-1 rtl:space-x-reverse">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 bg-black/30 text-white hover:bg-black/50"
                        onClick={() => setShowHistory(!showHistory)}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant={batchMode ? "default" : "ghost"}
                        size="icon" 
                        className={`h-8 w-8 ${!batchMode ? 'bg-black/30 text-white hover:bg-black/50' : ''}`}
                        onClick={toggleBatchMode}
                      >
                        <Scan className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="bg-white/20 px-2 py-1 rounded-full text-white text-xs">
                      {processedCodesCount > 0 && (
                        <span className="ml-1">{processedCodesCount} تم مسحه</span>
                      )}
                      {totalScansInSession > 0 && (
                        <span className="mx-1">{successfulScansInSession}/{totalScansInSession}</span>
                      )}
                      {totalPointsInSession > 0 && (
                        <span className="mr-1">{totalPointsInSession} نقطة</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Bar - BOTTOM */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <Button 
                      onClick={stopScanner} 
                      variant="destructive" 
                      size="sm"
                      className="rounded-full"
                    >
                      <X className="mr-1 h-4 w-4" />
                      إغلاق الكاميرا
                    </Button>
                  </div>
                  
                  {/* Instructions - UPPER MIDDLE */}
                  <div className="absolute top-12 left-0 right-0 text-center pointer-events-none">
                    <div className="bg-black/50 text-white px-3 py-1 rounded-full inline-block text-sm font-medium">
                      وجه الكاميرا نحو رمز QR
                    </div>
                  </div>
                  
                  {/* Cooldown Overlay */}
                  {cooldownActive && lastScannedCode && (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                      qrTrackerRef.current.isProcessed(lastScannedCode) 
                        ? 'bg-red-900/40' 
                        : 'bg-amber-900/40'
                    }`}>
                      {qrTrackerRef.current.isProcessed(lastScannedCode) ? (
                        <div className="bg-black/80 border border-red-500 rounded-lg p-4 max-w-[85%] text-center shadow-md">
                          <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                          <p className="text-white font-bold text-base">تم معالجة هذا الكود مسبقاً</p>
                          <p className="text-gray-300 text-sm">لا يمكن مسح نفس الكود مرتين</p>
                        </div>
                      ) : (
                        <div className="bg-black/80 border border-amber-500 rounded-lg p-4 max-w-[85%] text-center shadow-md">
                          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-2" />
                          <p className="text-white font-bold text-base">انتظر قليلاً</p>
                          <p className="text-gray-300 text-sm">يرجى الانتظار قبل مسح كود آخر</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                  <QrCode className="h-16 w-16 text-gray-300 mb-3" />
                  <p className="text-center text-gray-500 mb-5">قم بفتح الكاميرا لبدء المسح</p>
                  <Button 
                    onClick={startScanner} 
                    size="lg"
                    className="rounded-full px-8"
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    فتح الكاميرا
                  </Button>
                </div>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4">
                  <XCircle className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-center text-white mb-5 max-w-[80%]">{error}</p>
                  <Button variant="outline" onClick={() => setError(null)}>
                    حاول مرة أخرى
                  </Button>
                </div>
              )}
            </div>
            
            {/* History Panel - Collapsible */}
            {showHistory && (
              <div className="bg-white p-2 border-t border-gray-200 max-h-[30vh] overflow-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">آخر عمليات المسح</h3>
                  {processedCodesCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 py-0 px-2"
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
                      <RefreshCw className="h-3 w-3 ml-1" />
                      <span className="text-xs">إعادة تعيين</span>
                    </Button>
                  )}
                </div>
                
                {scanHistory.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-2">لا توجد عمليات مسح سابقة</p>
                ) : (
                  <div className="space-y-1">
                    {scanHistory.map((item, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded-lg flex items-center justify-between ${
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