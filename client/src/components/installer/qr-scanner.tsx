import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, List, Loader2, QrCode, ToggleLeft, ToggleRight, XCircle } from "lucide-react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useAuth } from "@/hooks/auth-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

// Advanced QR code tracker with both temporary cooldown and permanent tracking
class QrCodeTracker {
  // Temporary cooldown for UI feedback
  private cooldownCodes: Map<string, number> = new Map();
  // Permanent tracking of processed codes
  private processedCodes: Set<string> = new Set();
  private readonly cooldownPeriod: number; // milliseconds
  
  constructor(cooldownPeriod: number = 5000) { // 5 seconds default cooldown
    this.cooldownPeriod = cooldownPeriod;
    
    // Try to restore processed codes from sessionStorage
    try {
      const saved = sessionStorage.getItem('processedQrCodes');
      if (saved) {
        this.processedCodes = new Set(JSON.parse(saved));
        console.log(`Restored ${this.processedCodes.size} previously processed QR codes`);
      }
    } catch (e) {
      console.error("Failed to restore processed QR codes:", e);
    }
  }
  
  // Check if code can be processed (not in cooldown and not processed before)
  canProcessCode(qrCode: string): boolean {
    const now = Date.now();
    const lastScanTime = this.cooldownCodes.get(qrCode);
    
    // Check cooldown first
    if (lastScanTime && (now - lastScanTime) < this.cooldownPeriod) {
      // Code is still in cooldown period
      return false;
    }
    
    // Record this scan timing for cooldown
    this.cooldownCodes.set(qrCode, now);
    
    // Cleanup expired cooldown entries
    this.cleanup(now);
    
    // Check if code has been processed before
    return !this.processedCodes.has(qrCode);
  }
  
  // Mark a code as fully processed
  markProcessed(qrCode: string): void {
    // Add to permanent processed set
    this.processedCodes.add(qrCode);
    
    // Save to sessionStorage for persistence
    try {
      sessionStorage.setItem('processedQrCodes', JSON.stringify([...this.processedCodes]));
    } catch (e) {
      console.error("Failed to save processed QR codes:", e);
    }
  }
  
  // Check if a code is already processed (without affecting cooldown)
  isProcessed(qrCode: string): boolean {
    return this.processedCodes.has(qrCode);
  }
  
  private cleanup(now: number) {
    // Remove codes that have expired their cooldown period
    Array.from(this.cooldownCodes.entries()).forEach(([code, time]) => {
      if ((now - time) > this.cooldownPeriod) {
        this.cooldownCodes.delete(code);
      }
    });
  }
  
  // Reset temporary cooldown tracking but keep processed codes
  resetCooldown() {
    this.cooldownCodes.clear();
  }
  
  // Full reset (for testing)
  fullReset() {
    this.cooldownCodes.clear();
    this.processedCodes.clear();
    try {
      sessionStorage.removeItem('processedQrCodes');
    } catch (e) {
      console.error("Failed to clear processed QR codes:", e);
    }
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
  const [showHistory, setShowHistory] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(3000); // 3 seconds cooldown
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const audioSuccessRef = useRef<HTMLAudioElement | null>(null);
  const audioErrorRef = useRef<HTMLAudioElement | null>(null);
  const qrTrackerRef = useRef<QrCodeTracker>(new QrCodeTracker(3000)); // 3 seconds cooldown
  
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  // Initialize audio elements
  useEffect(() => {
    // Create audio elements for success and error sounds
    audioSuccessRef.current = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFpgCCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAYBAAAAAAAABaZ/9L2kAAAAAAAAAAAAAAAAAAAAAP/7kGQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==");
    audioErrorRef.current = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFpgCenp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp7///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAaEAAAAAAAABaZeXp0BAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==");
    
    return () => {
      // Cleanup audio elements
      if (audioSuccessRef.current) {
        audioSuccessRef.current = null;
      }
      if (audioErrorRef.current) {
        audioErrorRef.current = null;
      }
    };
  }, []);

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
    setIsScanning(true);
    setError(null);

    const qrCodeId = "qr-reader";
    const qrContainer = document.getElementById(qrCodeId);
    
    if (!qrContainer) {
      setError("QR scanner element not found (ERROR_CODE: ELEMENT_NOT_FOUND)");
      setIsScanning(false);
      return;
    }

    html5QrcodeRef.current = new Html5Qrcode(qrCodeId);

    try {
      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        (errorMessage) => {
          // Don't show QR scanning errors to users, as they are not useful
          console.log("QR scan error:", errorMessage);
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
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
    console.log("QR code detected:", decodedText);
    
    // Always set the last scanned code
    setLastScannedCode(decodedText);
    
    // First check if it's already been fully processed (validated and saved)
    if (qrTrackerRef.current.isProcessed(decodedText)) {
      console.log("QR code already processed:", decodedText);
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
      
      // Reset cooldown indicator after a short time
      setTimeout(() => {
        setCooldownActive(false);
      }, 1000);
      
      return;
    }
    
    // Then check if it's in cooldown period
    if (!qrTrackerRef.current.canProcessCode(decodedText)) {
      console.log("QR code in cooldown period, ignoring:", decodedText);
      // Show visual feedback that code is in cooldown
      setCooldownActive(true);
      
      // Reset cooldown indicator after a short time
      setTimeout(() => {
        setCooldownActive(false);
      }, 1000);
      
      return;
    }
    
    // In batch mode, we don't stop the scanner between scans
    if (!batchMode) {
      await stopScanner();
    }
    
    await validateQrCode(decodedText);
  };

  const validateQrCode = async (url: string) => {
    setIsValidating(true);
    setError(null);
    setTotalScansInSession(prev => prev + 1);

    // Step 1: URL shape validation
    const urlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    const match = url.match(urlRegex);
    
    if (!match) {
      const errorMsg = "Invalid QR code format. Please scan a valid warranty code. (ERROR_CODE: INVALID_FORMAT)";
      setError(errorMsg);
      setIsValidating(false);
      playErrorSound();
      
      // Add to scan history
      addToScanHistory({
        productName: "Unknown",
        timestamp: new Date(),
        points: 0,
        status: 'error',
        message: "Invalid QR code format"
      });
      
      // In batch mode, restart scanner after error
      if (batchMode) {
        // Don't need to restart scanner as it's already running
        setIsValidating(false);
      }
      
      return;
    }

    const uuid = match[1];
    console.log("Extracted UUID:", uuid);

    // Step 2: UUID validation
    if (!isValidUUIDv4(uuid)) {
      const errorMsg = "Invalid product code UUID. Please scan a valid warranty code. (ERROR_CODE: INVALID_UUID)";
      setError(errorMsg);
      setIsValidating(false);
      playErrorSound();
      
      // Add to scan history
      addToScanHistory({
        productName: "Unknown",
        timestamp: new Date(),
        points: 0,
        status: 'error',
        message: "Invalid UUID format"
      });
      
      // In batch mode, restart scanner after error
      if (batchMode) {
        // Don't need to restart scanner as it's already running
        setIsValidating(false);
      }
      
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
        const errorMsg = `${result.message}${errorCode}\n${errorDetails}`;
        
        setError(errorMsg);
        setIsValidating(false);
        playErrorSound();
        
        console.error('QR Validation Error:', {
          message: result.message,
          code: result.error_code,
          details: result.details
        });
        
        // Add to scan history
        addToScanHistory({
          productName: result.productName || "Unknown",
          timestamp: new Date(),
          points: 0,
          status: 'error',
          message: result.message
        });
        
        if (result.details?.duplicate) {
          // If it's a duplicate, allow user to scan again
          if (!batchMode) {
            startScanner();
          } else {
            // In batch mode, don't need to restart the scanner
            setIsValidating(false);
          }
        }
        
        return;
      }
      
      // Success path
      setIsValidating(false);
      playSuccessSound();
      setSuccessfulScansInSession(prev => prev + 1);
      
      // Update points total for this session
      const pointsAwarded = result.pointsAwarded || 0;
      setTotalPointsInSession(prev => prev + pointsAwarded);
      
      // Mark this QR code as permanently processed
      // This will prevent it from being scanned again in this session
      qrTrackerRef.current.markProcessed(url);
      console.log(`Marked QR code as processed: ${url}`);
      
      // If not in batch mode, close the dialog
      if (!batchMode) {
        setIsOpen(false);
      }
      
      // Log success and product name
      console.log("Scanned product:", result.productName);
      
      // Add to scan history
      addToScanHistory({
        productName: result.productName || "Unknown",
        timestamp: new Date(),
        points: pointsAwarded,
        status: 'success'
      });
      
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
      
      // Show success toast only if not in batch mode 
      // In batch mode we show a floating notification instead
      if (!batchMode) {
        toast({
          title: "Product Verified Successfully ✓",
          description: `Product: ${result.productName || "Unknown"}\nPoints awarded: ${pointsAwarded}`,
          variant: "default",
        });
      }
      
      if (onScanSuccess) {
        onScanSuccess(result.productName);
      }
      
    } catch (err: any) {
      console.error("Validation error:", err);
      const errorMsg = `Error validating QR code. Please try again. (ERROR_CODE: VALIDATION_ERROR)\n\nDetails: ${err.message || "Unknown error"}`;
      setError(errorMsg);
      setIsValidating(false);
      playErrorSound();
      
      // Add to scan history
      addToScanHistory({
        productName: "Unknown",
        timestamp: new Date(),
        points: 0,
        status: 'error',
        message: err.message || "Validation Error"
      });
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
      
      // Reset the QR tracker when closing the scanner
      qrTrackerRef.current.reset();
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
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-xl">
              مسح رمز الاستجابة السريعة
            </DialogTitle>
          </DialogHeader>

          <div className="my-2">
            {/* Batch Mode Toggle */}
            <div className="flex items-center justify-between mb-3 rounded-lg p-2 bg-primary/10">
              <div className="flex items-center gap-2">
                <Switch id="batch-mode" checked={batchMode} onCheckedChange={toggleBatchMode} />
                <Label htmlFor="batch-mode" className="text-sm font-medium cursor-pointer">
                  وضع المسح المتتابع {batchMode ? <ToggleRight className="inline h-4 w-4 ml-1" /> : <ToggleLeft className="inline h-4 w-4 ml-1" />}
                </Label>
              </div>
              
              {/* History Toggle */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowHistory(!showHistory)}
                className={cn("px-2 py-1 h-8", showHistory ? "bg-primary/20" : "")}
              >
                <List className="h-4 w-4 mr-1" />
                <span className="text-xs">السجل</span>
              </Button>
            </div>
            
            {/* Session Stats */}
            {(totalScansInSession > 0 || batchMode) && (
              <div className="flex justify-between items-center mb-3 p-2 rounded-lg bg-muted/50">
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
            
            {/* Scan History */}
            {showHistory && scanHistory.length > 0 && (
              <div className="mb-3 max-h-40 overflow-y-auto p-2 border rounded-lg">
                <h4 className="text-sm font-bold mb-2">سجل المسح</h4>
                {scanHistory.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs mb-1 p-1 border-b last:border-b-0">
                    <div className="flex items-center gap-1">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="truncate max-w-[120px]">{item.productName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.status === 'success' && (
                        <Badge variant="outline" className="h-5 px-1">+{item.points}</Badge>
                      )}
                      <span className="text-muted-foreground">{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Batch Mode Active Notification */}
            {batchMode && isScanning && !isValidating && !error && (
              <div className="mb-4 p-2 bg-green-100 text-green-800 rounded-lg border border-green-300 text-sm text-center">
                <div className="font-medium">وضع المسح المتتابع نشط</div>
                <div className="text-xs">استمر في مسح المنتجات بشكل متتابع</div>
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded border border-destructive text-sm">
                <div className="whitespace-pre-wrap font-mono text-xs">{error}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 w-full" 
                  onClick={() => setError(null)}
                >
                  إغلاق الخطأ
                </Button>
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              {isValidating ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-center text-gray-500">جارٍ التحقق من الكود...</p>
                </div>
              ) : (
                <>
                  <div
                    id="qr-reader"
                    className={`w-full overflow-hidden rounded-lg border ${
                      isScanning ? "h-64" : "h-0"
                    }`}
                  ></div>
                  
                  {/* Cooldown indicator (separate from scanner) */}
                  {cooldownActive && isScanning && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-300 rounded-lg text-center">
                      <p className="text-orange-600 font-bold">انتظر قليلاً</p>
                      <p className="text-orange-600 text-xs">تم مسح هذا الكود بالفعل</p>
                    </div>
                  )}

                  {!isScanning ? (
                    <Button 
                      onClick={startScanner} 
                      className="w-full"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      فتح الكاميرا
                    </Button>
                  ) : (
                    <Button 
                      onClick={stopScanner} 
                      variant="outline" 
                      className="w-full"
                    >
                      إغلاق الكاميرا
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}