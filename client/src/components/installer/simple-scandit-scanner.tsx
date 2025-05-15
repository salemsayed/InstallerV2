import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SimpleScanditScannerProps {
  onScanSuccess: (data: string, symbology: string) => void;
  isEnabled?: boolean;
  className?: string;
  licenseKey: string;
}

export default function SimpleScanditScanner({
  onScanSuccess,
  isEnabled = true,
  className = '',
  licenseKey
}: SimpleScanditScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Check for HTTPS protocol
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('يرجى استخدام بروتوكول HTTPS لاستخدام الماسح المتقدم');
      setIsLoading(false);
      return;
    }
    
    // Create script elements for loading the SDK libraries
    const coreScript = document.createElement('script');
    coreScript.src = 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core/build/engine/index.min.js';
    
    const barcodeScript = document.createElement('script');
    barcodeScript.src = 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode/build/engine/index.min.js';
    
    // Add custom initialization script
    const initScript = document.createElement('script');
    initScript.type = 'text/javascript';
    
    // Only initialize once both scripts are loaded
    let coreLoaded = false;
    let barcodeLoaded = false;
    
    const initScandit = () => {
      if (!coreLoaded || !barcodeLoaded) return;
      
      // Initialize Scandit
      const scanditInitCode = `
        try {
          // Initialize scandit with license key
          const ScanditSDK = window.ScanditSDK;
          ScanditSDK.configure({
            licenseKey: "${licenseKey}",
            engineLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode/build/engine/"
          }).then(() => {
            const { DataCaptureView, Camera, BarcodeCaptureSettings, BarcodeCapture, Symbology } = ScanditSDK;
            
            // Create data capture context
            const context = new ScanditSDK.DataCaptureContext({ licenseKey: "${licenseKey}" });
            
            // Get camera if available
            ScanditSDK.Camera.getDefaultCameraDeviceId()
              .then(deviceId => {
                if (!deviceId) {
                  window.dispatchEvent(new CustomEvent('scandit-error', { 
                    detail: 'No camera available' 
                  }));
                  return;
                }
                
                const camera = ScanditSDK.Camera.withSettings({
                  preferredResolution: 'HD',
                  deviceId: deviceId
                });
                
                // Set camera as frame source
                context.setFrameSource(camera);
                
                // Create view
                const view = new DataCaptureView({ context });
                const scanditContainer = document.getElementById('scandit-container');
                view.connectToElement(scanditContainer);
                
                // Configure barcode scanning
                const settings = new BarcodeCaptureSettings();
                settings.enableSymbologies([
                  Symbology.QR,
                  Symbology.DataMatrix,
                  Symbology.Code128,
                  Symbology.EAN13UPCA,
                  Symbology.EAN8
                ]);
                
                // Create barcode capture
                const barcodeCapture = new BarcodeCapture({ context, settings });
                
                // Add listener
                barcodeCapture.addListener({
                  didScan: (barcodeCapture, session) => {
                    const barcode = session.newlyRecognizedBarcodes[0];
                    if (barcode) {
                      const data = barcode.data;
                      const symbology = barcode.symbology;
                      window.dispatchEvent(new CustomEvent('scandit-success', { 
                        detail: { data, symbology } 
                      }));
                      barcodeCapture.setEnabled(false);
                    }
                  }
                });
                
                // Enable scanner
                barcodeCapture.setEnabled(true);
                camera.switchToDesiredState(ScanditSDK.FrameSourceState.On);
                
                // Store components in global scope for external access
                window.scanditComponents = {
                  context,
                  view,
                  camera,
                  barcodeCapture
                };
                
                window.dispatchEvent(new Event('scandit-loaded'));
              })
              .catch(error => {
                window.dispatchEvent(new CustomEvent('scandit-error', { 
                  detail: 'Failed to access camera: ' + error.message 
                }));
              });
          }).catch(error => {
            window.dispatchEvent(new CustomEvent('scandit-error', { 
              detail: 'Failed to configure Scandit SDK: ' + error.message 
            }));
          });
        } catch (error) {
          window.dispatchEvent(new CustomEvent('scandit-error', { 
            detail: 'Failed to initialize Scandit SDK: ' + error.message 
          }));
        }
      `;
      
      initScript.textContent = scanditInitCode;
      document.head.appendChild(initScript);
    };
    
    // Event listeners
    const handleSuccess = (event: any) => {
      const { data, symbology } = event.detail;
      onScanSuccess(data, symbology);
    };
    
    const handleError = (event: any) => {
      setError(event.detail);
      setIsLoading(false);
    };
    
    const handleLoaded = () => {
      setIsLoading(false);
    };
    
    window.addEventListener('scandit-success', handleSuccess);
    window.addEventListener('scandit-error', handleError);
    window.addEventListener('scandit-loaded', handleLoaded);
    
    // Handle script loading
    coreScript.onload = () => {
      coreLoaded = true;
      initScandit();
    };
    
    barcodeScript.onload = () => {
      barcodeLoaded = true;
      initScandit();
    };
    
    coreScript.onerror = () => {
      setError('Failed to load Scandit core library');
      setIsLoading(false);
    };
    
    barcodeScript.onerror = () => {
      setError('Failed to load Scandit barcode library');
      setIsLoading(false);
    };
    
    // Add scripts to DOM
    document.head.appendChild(coreScript);
    document.head.appendChild(barcodeScript);
    
    // Cleanup function
    return () => {
      window.removeEventListener('scandit-success', handleSuccess);
      window.removeEventListener('scandit-error', handleError);
      window.removeEventListener('scandit-loaded', handleLoaded);
      
      // Cleanup Scandit components
      if ((window as any).scanditComponents) {
        try {
          const { barcodeCapture, camera, context } = (window as any).scanditComponents;
          if (barcodeCapture) barcodeCapture.setEnabled(false);
          if (camera) camera.switchToDesiredState(1); // Off state
          if (context) context.dispose();
        } catch (e) {
          console.warn('Error during Scandit cleanup:', e);
        }
      }
      
      // Remove scripts
      if (coreScript.parentNode) coreScript.parentNode.removeChild(coreScript);
      if (barcodeScript.parentNode) barcodeScript.parentNode.removeChild(barcodeScript);
      if (initScript.parentNode) initScript.parentNode.removeChild(initScript);
    };
  }, [licenseKey, onScanSuccess]);
  
  // Check if error is related to camera access
  const isCameraAccessError = error && (
    error.includes("No camera available") || 
    error.includes("Failed to access camera") ||
    error.includes("Camera access")
  );
  
  // Check if error is related to resource loading
  const isResourceError = error && (
    error.includes("Error 28") || 
    error.includes("Failed to load") || 
    error.includes("Failed to configure") ||
    error.includes("Failed to initialize")
  );
  
  // Check if error is related to HTTPS protocol
  const isProtocolError = error && error.includes("HTTPS");
  
  return (
    <div className={`relative ${className}`}>
      <div 
        id="scandit-container"
        ref={containerRef}
        className="w-full h-full min-h-[60vh] bg-black"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">جاري تحميل الماسح المتقدم...</p>
          </div>
        </div>
      )}
      
      {error && !isCameraAccessError && !isResourceError && !isProtocolError && (
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
      
      {isProtocolError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div className="max-w-md">
            <p className="text-red-500 font-bold mb-2">بروتوكول غير آمن</p>
            <p className="mb-4">يتطلب الماسح المتقدم استخدام بروتوكول HTTPS الآمن للعمل بشكل صحيح</p>
            <div className="bg-gray-800 rounded p-3 text-sm">
              <p className="text-right mb-2">الحلول:</p>
              <ul className="text-right list-disc list-inside space-y-1">
                <li>استخدم رابط HTTPS بدلاً من HTTP</li>
                <li>قم بتثبيت التطبيق على الهاتف من خلال رابط HTTPS</li>
                <li>استخدم متصفحاً حديثاً يدعم HTTPS</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {isResourceError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div className="max-w-md">
            <p className="text-red-500 font-bold mb-2">تعذر تحميل موارد الماسح</p>
            <p className="mb-4">يواجه الماسح مشكلة في تحميل الموارد المطلوبة للعمل بشكل صحيح</p>
            <div className="bg-gray-800 rounded p-3 text-sm">
              <p className="text-right mb-2">الحلول المحتملة:</p>
              <ul className="text-right list-disc list-inside space-y-1">
                <li>تأكد من اتصالك بالإنترنت</li>
                <li>استخدم متصفح حديث (مثل Chrome أو Safari)</li>
                <li>امنح التطبيق الأذونات اللازمة</li>
                <li>تأكد من استخدام رابط HTTPS</li>
              </ul>
            </div>
            <Button 
              onClick={() => window.location.reload()}
              variant="default"
              size="sm"
              className="mt-4"
            >
              إعادة تحميل الصفحة
            </Button>
          </div>
        </div>
      )}
      
      {isCameraAccessError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div className="max-w-md">
            <p className="text-yellow-400 font-bold mb-2">لا يمكن الوصول إلى الكاميرا</p>
            <p className="mb-4">يجب الوصول إلى كاميرا الجهاز لاستخدام الماسح المتقدم</p>
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