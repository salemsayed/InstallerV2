import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useAuth } from "@/hooks/auth-provider";

// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

export default function StandaloneScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [points, setPoints] = useState<number>(0);
  
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  // Audio elements for feedback
  const successAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFpgCCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAYBAAAAAAAABaZ/9L2kAAAAAAAAAAAAAAAAAAAAAP/7kGQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==");
  const errorAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFpgCenp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp6enp7///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAaEAAAAAAAABaZeXp0BAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==");

  // Initialize the scanner when component mounts
  useEffect(() => {
    startScanner();
    
    // Clean up the scanner on unmount
    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(err => 
          console.error("Error stopping scanner:", err)
        );
      }
    };
  }, []);

  // Function to handle successful scans
  const handleScanSuccess = async (decodedText: string) => {
    if (isValidating) return; // Prevent multiple validations at once
    
    setResult(decodedText);
    setIsValidating(true);
    
    try {
      // Validate QR code format (UUID)
      if (!isValidUUIDv4(decodedText)) {
        throw new Error("Invalid QR code format. Expected UUID format.");
      }
      
      // Call API to validate the scanned code
      const response = await apiRequest("POST", "/api/scan-qr", { code: decodedText });
      const data = await response.json();
      
      if (data.success) {
        // Play success sound
        successAudio.play().catch(e => console.error("Error playing success sound:", e));
        
        // Show success message
        setProductName(data.productName);
        setPoints(data.pointsAwarded);
        
        toast({
          title: "تم التحقق من المنتج بنجاح",
          description: `${data.productName} - تمت إضافة ${data.pointsAwarded} نقطة`,
        });
        
        // Refresh user data to show updated points
        refreshUser();
        
        // Reset for next scan
        setTimeout(() => {
          setIsValidating(false);
          setResult(null);
          setProductName(null);
        }, 3000);
      } else {
        throw new Error(data.message || "Validation failed");
      }
    } catch (err: any) {
      // Play error sound
      errorAudio.play().catch(e => console.error("Error playing error sound:", e));
      
      // Show error
      setError(err.message || "خطأ في التحقق من الرمز");
      toast({
        title: "خطأ في التحقق",
        description: err.message || "خطأ في التحقق من الرمز",
        variant: "destructive",
      });
      
      // Reset after delay
      setTimeout(() => {
        setIsValidating(false);
        setResult(null);
        setError(null);
      }, 3000);
    }
  };

  // Start the QR scanner
  const startScanner = () => {
    setIsScanning(true);
    
    const qrCodeId = "qr-reader-standalone";
    
    // Create scanner
    html5QrcodeRef.current = new Html5Qrcode(qrCodeId);
    
    // Start scanning
    html5QrcodeRef.current.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      handleScanSuccess,
      (errorMessage) => {
        console.log("QR scan error:", errorMessage);
      }
    ).catch(err => {
      console.error("Error starting scanner:", err);
      setError("فشل في بدء الكاميرا. يرجى التحقق من إذن الكاميرا.");
      setIsScanning(false);
    });
  };

  // Main render
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Success message */}
      {productName && !error && (
        <div className="mb-4 p-4 bg-green-100 text-green-800 rounded-lg border border-green-300 flex flex-col items-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
          <h3 className="font-bold text-lg">{productName}</h3>
          <p>تمت إضافة {points} نقطة</p>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg border border-red-300 flex flex-col items-center">
          <XCircle className="h-10 w-10 text-red-500 mb-2" />
          <p>{error}</p>
        </div>
      )}
      
      {/* Scanner container */}
      <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-square">
        <div id="qr-reader-standalone" className="w-full h-full"></div>
        
        {/* Loading Overlay */}
        {isValidating && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
            <p className="text-white text-center">جارٍ التحقق من الكود...</p>
          </div>
        )}
        
        {/* Scan Guide Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="border-2 border-white/50 rounded-lg w-[250px] h-[250px] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
      </div>
      
      {/* Status text */}
      <div className="mt-4 text-center text-gray-600">
        {isScanning && !isValidating ? (
          <p>جاهز للمسح. ضع رمز QR في الإطار.</p>
        ) : isValidating ? (
          <p>جارٍ التحقق من الكود...</p>
        ) : (
          <p>جارٍ تهيئة الكاميرا...</p>
        )}
      </div>
    </div>
  );
}