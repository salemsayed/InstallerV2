import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

// Import Scandit libraries
import {
  configure,
  DataCaptureView,
  Camera,
  DataCaptureContext,
  FrameSourceState
} from '@scandit/web-datacapture-core';

import {
  barcodeCaptureLoader,
  BarcodeCaptureSettings,
  BarcodeCapture,
  Symbology,
  SymbologyDescription
} from '@scandit/web-datacapture-barcode';

interface ScanditScannerProps {
  onScanSuccess: (data: string, symbology: string) => void;
  onError?: (error: Error) => void;
  isEnabled?: boolean;
  className?: string;
  licenseKey: string;
}

export default function ScanditScanner({ 
  onScanSuccess, 
  isEnabled = true, 
  className = '', 
  licenseKey
}: ScanditScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeCaptureMode, setBarcodeCaptureMode] = useState<BarcodeCapture | null>(null);
  
  const { toast } = useToast();

  const logInfo = (message: string) => {
    console.log(`[Scandit Scanner] INFO: ${message}`);
  };

  const logError = (message: string, error?: any) => {
    const errorMessage = error ? `${message}: ${error.message || JSON.stringify(error)}` : message;
    console.error(`[Scandit Scanner] ERROR: ${errorMessage}`);
    
    // Special handling for Error 28 - resource load failure
    if (typeof error === 'object' && error?.message?.includes('Error 28')) {
      setError('Error 28: The Scandit SDK could not access a required resource to operate');
      return; // Don't show toast for this common error
    }
    
    setError(errorMessage);
    
    toast({
      title: 'خطأ في الماسح الضوئي',
      description: errorMessage,
      variant: 'destructive',
    });
  };

  const initializeScanner = async () => {
    if (!containerRef.current) {
      logError('Container reference not found');
      return;
    }

    try {
      logInfo('Initializing Scandit scanner...');
      
      /**
       * IMPORTANT: Setup Scandit global namespace before configure()
       * This is a workaround for Error 28 issues
       */
      const globalAny = window as any;
      globalAny.ScanditSDK = globalAny.ScanditSDK || {};
      globalAny.ScanditSDK.engineLocation = 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.2/build/engine/';
      
      logInfo('Configuring Scandit license...');
      try {
        logInfo('Configuring Scandit with library from CDN...');
        await configure({
          licenseKey: licenseKey,
          moduleLoaders: [barcodeCaptureLoader()],
          libraryLocation: 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.2/build/',
          engineLocation: 'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.2/build/engine/',
        });
        logInfo('Scandit configuration successful');
      } catch (configError) {
        logError('Failed to configure Scandit', configError);
        throw configError; // Re-throw to be caught by the outer try-catch
      }
      
      // Create and initialize the data capture view
      const view = new DataCaptureView();
      
      // Connect the view to the HTML container
      view.connectToElement(containerRef.current);
      
      // Create the data capture context with license key - using the correct API method
      const context = new DataCaptureContext({ licenseKey: licenseKey });
      
      // Set the context to the view
      view.setContext(context);
      
      try {
        // In v7.2.2, we need to access camera differently
        // First check if camera is available
        const deviceId = await Camera.getDefaultCameraDeviceId();
        if (!deviceId) {
          throw new Error('No camera available');
        }
        
        // Then create camera instance
        const camera = Camera.withSettings({
          preferredResolution: 'HD',
          focusRange: 'Far',
          deviceId: deviceId
        });
        
        // Apply recommended camera settings - note API method changes in v7.2.2
        const cameraSettings = BarcodeCapture.recommendedCameraSettings;
        await camera.applySettings(cameraSettings);
        
        // Set the camera as the frame source
        await context.setFrameSource(camera);
        
        // Create barcode capture settings
        const settings = new BarcodeCaptureSettings();
        
        // Enable QR and other common barcode symbologies
        settings.enableSymbologies([
          Symbology.QR,
          Symbology.DataMatrix,
          Symbology.Code128,
          Symbology.EAN13UPCA,
          Symbology.EAN8
        ]);
      
        // Create barcode capture with settings (using proper API for version 7.2.2)
        const barcodeCapture = new BarcodeCapture({ context, settings });
        setBarcodeCaptureMode(barcodeCapture);
        
        // Add listener for barcode scanning
        barcodeCapture.addListener({
          didScan: (_, session) => {
            const barcode = session.newlyRecognizedBarcodes[0];
            if (!barcode) return;
            
            const data = barcode.data || '';
            const symbology = new SymbologyDescription(barcode.symbology);
            
            logInfo(`Barcode scanned: ${data} (${symbology.identifier})`);
            
            // Pause scanning while processing
            barcodeCapture.setEnabled(false);
            
            // Call the onScanSuccess callback with scan data
            onScanSuccess(data, symbology.identifier);
          }
        });
        
        // Enable the barcode capture and camera
        await barcodeCapture.setEnabled(isEnabled);
        
        if (isEnabled) {
          await camera.switchToDesiredState(FrameSourceState.On);
        }
        
        setIsInitialized(true);
        logInfo('Scandit scanner initialization complete');
      } catch (cameraError) {
        logError('Camera access error', cameraError);
        setIsInitialized(true); // Mark as initialized even with camera errors
      }
    } catch (error: any) {
      // Special handling for Error 28
      if (error.message && error.message.includes('Error 28')) {
        setError('Error 28: The Scandit SDK could not access a required resource to operate');
      } else {
        logError('Failed to initialize scanner', error);
      }
    }
  };

  useEffect(() => {
    // Check for HTTPS protocol
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('يرجى استخدام بروتوكول HTTPS لاستخدام الماسح المتقدم');
      return;
    }
    
    initializeScanner();
    
    // Cleanup function
    return () => {
      const cleanup = async () => {
        if (barcodeCaptureMode) {
          try {
            await barcodeCaptureMode.setEnabled(false);
            logInfo('Barcode capture disabled during cleanup');
          } catch (error) {
            console.warn('Error during scanner cleanup:', error);
          }
        }
      };
      
      cleanup();
    };
  }, []);

  // Effect to handle enabling/disabling the scanner
  useEffect(() => {
    if (!isInitialized || !barcodeCaptureMode) return;
    
    const updateScanner = async () => {
      try {
        await barcodeCaptureMode.setEnabled(isEnabled);
        logInfo(`Scanner ${isEnabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        logError('Failed to update scanner state', error);
      }
    };
    
    updateScanner();
  }, [isEnabled, isInitialized, barcodeCaptureMode]);

  // Check if the error is related to camera access, resource loading, or protocol
  const isCameraAccessError = error && (
    error.includes("No camera available") || 
    error.includes("Camera access") ||
    error.includes("Could not start camera")
  );
  
  const isResourceError = error && (
    error.includes("Error 28") || 
    error.includes("could not access a required resource") ||
    error.includes("Failed to load resource")
  );
  
  const isProtocolError = error && error.includes("HTTPS");
  
  return (
    <div className={`relative ${className}`}>
      <div 
        ref={containerRef} 
        className="w-full h-full min-h-[60vh] bg-black"
      />
      
      {error && !isCameraAccessError && !isResourceError && !isProtocolError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div>
            <p className="text-red-500 font-bold mb-2">حدث خطأ في تشغيل الماسح</p>
            <p>{error}</p>
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
      
      {isCameraAccessError && isInitialized && (
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
      
      {!isInitialized && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">جاري تحميل الماسح المتقدم...</p>
          </div>
        </div>
      )}
    </div>
  );
}