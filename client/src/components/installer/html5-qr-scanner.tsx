import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Html5QrScannerProps {
  onScanSuccess: (data: string) => void;
  isEnabled?: boolean;
  className?: string;
}

export default function Html5QrScanner({
  onScanSuccess,
  isEnabled = true,
  className = '',
}: Html5QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html5QrScanner, setHtml5QrScanner] = useState<any>(null);
  
  useEffect(() => {
    // Create script element for loading the QR library
    const html5QrScript = document.createElement('script');
    html5QrScript.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    
    const initScanner = () => {
      try {
        if (!window.Html5Qrcode) {
          setError('فشل تحميل مكتبة المسح الضوئي');
          setIsLoading(false);
          return;
        }
        
        if (!containerRef.current) {
          setError('فشل تهيئة الماسح');
          setIsLoading(false);
          return;
        }
        
        // Create scanner instance
        const scanner = new window.Html5Qrcode("qr-reader");
        setHtml5QrScanner(scanner);
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          // Use medium quality for better performance
          formatsToSupport: [
            window.Html5QrcodeSupportedFormats.QR_CODE,
            window.Html5QrcodeSupportedFormats.DATA_MATRIX
          ]
        };
        
        if (isEnabled) {
          startScanner(scanner, config);
        }
        
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setError('فشل تهيئة الماسح الضوئي');
        setIsLoading(false);
      }
    };
    
    const startScanner = (scanner: any, config: any) => {
      // Facing mode - environment for back camera
      const facingMode = "environment";
      
      // Start scanning
      scanner.start(
        { facingMode },
        config,
        (decodedText: string) => {
          console.log('QR code detected:', decodedText);
          onScanSuccess(decodedText);
          
          // Optional: Pause scanner after successful scan
          try {
            scanner.pause();
            // Resume after 3 seconds
            setTimeout(() => {
              if (isEnabled) {
                scanner.resume();
              }
            }, 3000);
          } catch (err) {
            console.error('Error pausing scanner:', err);
          }
        },
        (errorMessage: string) => {
          // Ignored errors during scanning - these are usually just frames without QR codes
          // Only log to console in development
          if (process.env.NODE_ENV === 'development') {
            console.debug('QR scan process:', errorMessage);
          }
        }
      ).catch((err: any) => {
        console.error('Scanner start error:', err);
        setError('فشل في تشغيل كاميرا المسح');
        setIsLoading(false);
      });
      
      setIsLoading(false);
    };
    
    // Script load handlers
    html5QrScript.onload = initScanner;
    
    html5QrScript.onerror = () => {
      setError('فشل تحميل مكتبة المسح الضوئي');
      setIsLoading(false);
    };
    
    // Add script to DOM
    document.head.appendChild(html5QrScript);
    
    // Cleanup function
    return () => {
      if (html5QrScanner) {
        try {
          html5QrScanner.stop().catch((err: any) => {
            console.error('Error stopping scanner:', err);
          });
        } catch (e) {
          console.warn('Error during scanner cleanup:', e);
        }
      }
      
      if (html5QrScript.parentNode) {
        html5QrScript.parentNode.removeChild(html5QrScript);
      }
    };
  }, []);
  
  // Effect to handle enabling/disabling the scanner
  useEffect(() => {
    if (!html5QrScanner) return;
    
    try {
      if (isEnabled) {
        html5QrScanner.resume();
      } else {
        html5QrScanner.pause();
      }
    } catch (err) {
      console.error('Error changing scanner state:', err);
    }
  }, [isEnabled, html5QrScanner]);
  
  // Check if error is related to camera access
  const isCameraAccessError = error && (
    error.includes('كاميرا') ||
    error.toLowerCase().includes('camera')
  );
  
  return (
    <div className={`relative ${className}`}>
      <div 
        id="qr-reader"
        ref={containerRef}
        className="w-full h-full min-h-[60vh] bg-black overflow-hidden"
        style={{ aspectRatio: '4/3' }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">جاري تحميل الماسح الضوئي...</p>
          </div>
        </div>
      )}
      
      {error && !isCameraAccessError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div>
            <p className="text-red-500 font-bold mb-2">حدث خطأ في تشغيل الماسح</p>
            <p>{error}</p>
            <Button 
              onClick={() => window.location.reload()}
              variant="default"
              size="sm"
              className="mt-4"
            >
              إعادة المحاولة
            </Button>
          </div>
        </div>
      )}
      
      {isCameraAccessError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div className="max-w-md">
            <p className="text-yellow-400 font-bold mb-2">لا يمكن الوصول إلى الكاميرا</p>
            <p className="mb-4">يجب الوصول إلى كاميرا الجهاز لاستخدام الماسح الضوئي</p>
            <div className="bg-gray-800 rounded p-3 text-sm">
              <p className="text-right mb-2">للاستخدام:</p>
              <ul className="text-right list-disc list-inside space-y-1">
                <li>تأكد من منح التطبيق صلاحية استخدام الكاميرا</li>
                <li>استخدم هاتفك أو جهازاً به كاميرا</li>
                <li>استخدم متصفحاً يدعم الوصول إلى الكاميرا</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add global type declarations for HTML5 QR code scanner
declare global {
  interface Window {
    Html5Qrcode: any;
    Html5QrcodeSupportedFormats: {
      QR_CODE: number;
      DATA_MATRIX: number;
      [key: string]: number;
    };
  }
}