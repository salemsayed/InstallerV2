import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

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
  Symbology
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
  const contextRef = useRef<DataCaptureContext | null>(null);
  const viewRef = useRef<DataCaptureView | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const barcodeCaptureRef = useRef<BarcodeCapture | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      
      // Create and initialize the data capture view
      const view = new DataCaptureView();
      viewRef.current = view;
      
      // Connect the view to the HTML container
      view.connectToElement(containerRef.current);
      view.showProgressBar();
      
      logInfo('Configuring Scandit license...');
      // Configure Scandit with license key
      try {
        logInfo('Configuring Scandit with library from CDN...');
        await configure({
          licenseKey: licenseKey,
          moduleLoaders: [barcodeCaptureLoader()],
          // Use older, more stable version via unpkg CDN
          libraryLocation: 'https://unpkg.com/@scandit/datacapture-js-browser@6.16.1/build/',
          engineLocation: 'https://unpkg.com/@scandit/datacapture-js-browser@6.16.1/build/engine/',
        });
        logInfo('Scandit configuration successful');
      } catch (configError) {
        logError('Failed to configure Scandit', configError);
        throw configError; // Re-throw to be caught by the outer try-catch
      }
      
      view.hideProgressBar();
      
      logInfo('Creating DataCaptureContext...');
      // Create the data capture context
      const context = await DataCaptureContext.create();
      contextRef.current = context;
      
      // Set the context to the view
      await view.setContext(context);
      
      logInfo('Initializing camera...');
      // Initialize camera
      try {
        // Try to get the default camera
        const camera = Camera.default;
        if (!camera) {
          throw new Error('No camera available');
        }
        cameraRef.current = camera;
        
        // Apply recommended camera settings
        const cameraSettings = BarcodeCapture.recommendedCameraSettings;
        await camera.applySettings(cameraSettings);
        
        // Set the camera as the frame source
        await context.setFrameSource(camera);
      } catch (cameraError) {
        logError('Camera access error. This is expected in environments without camera access.', cameraError);
        // Continue with setup, just without a camera
        // This allows the scanner to still be initialized for testing purposes
      }
      
      logInfo('Creating barcode capture settings...');
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
      
      logInfo('Creating barcode capture...');
      // Create barcode capture with settings
      const barcodeCapture = await BarcodeCapture.forContext(context, settings);
      barcodeCaptureRef.current = barcodeCapture;
      
      // Add listener for barcode scanning
      barcodeCapture.addListener({
        didScan: async (_, session) => {
          const barcode = session.newlyRecognizedBarcodes[0];
          if (!barcode) return;
          
          const data = barcode.data || '';
          const symbologyName = barcode.symbology || 'Unknown';
          
          logInfo(`Barcode scanned: ${data} (${symbologyName})`);
          
          // Pause scanning while processing
          await barcodeCapture.setEnabled(false);
          
          // Call the onScanSuccess callback with scan data
          onScanSuccess(data, symbologyName);
          
          // Resume scanning after a short delay
          setTimeout(async () => {
            if (isEnabled && barcodeCaptureRef.current) {
              await barcodeCaptureRef.current.setEnabled(true);
            }
          }, 1000);
        }
      });
      
      // Enable the barcode capture
      await barcodeCapture.setEnabled(isEnabled);
      
      // Start the camera if available
      if (isEnabled && context.frameSource) {
        try {
          await context.frameSource.switchToDesiredState(FrameSourceState.On);
          logInfo('Camera started');
        } catch (cameraError) {
          logError('Could not start camera', cameraError);
          // Don't throw error here, continue with initialization
        }
      } else if (isEnabled) {
        logInfo('No camera available to start');
      }
      
      setIsInitialized(true);
      logInfo('Scandit scanner initialization complete');
      
    } catch (error: any) {
      logError('Failed to initialize scanner', error);
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
      const cleanupScanner = async () => {
        logInfo('Cleaning up scanner resources...');
        try {
          // Disable barcode capture
          if (barcodeCaptureRef.current) {
            try {
              await barcodeCaptureRef.current.setEnabled(false);
              logInfo('Barcode capture disabled');
            } catch (e) {
              logError('Could not disable barcode capture', e);
            }
          }
          
          // Turn off camera
          if (contextRef.current?.frameSource) {
            try {
              await contextRef.current.frameSource.switchToDesiredState(FrameSourceState.Off);
              logInfo('Camera turned off');
            } catch (e) {
              logError('Could not turn off camera', e);
            }
          }
          
          // Dispose of context
          if (contextRef.current) {
            try {
              await contextRef.current.dispose();
              contextRef.current = null;
              logInfo('Context disposed');
            } catch (e) {
              logError('Could not dispose context', e);
            }
          }
        } catch (error) {
          logError('Error during cleanup', error);
        }
      };
      
      cleanupScanner();
    };
  }, []);

  // Effect to handle enabling/disabling the scanner
  useEffect(() => {
    const updateScannerState = async () => {
      if (!isInitialized) return;
      
      try {
        if (barcodeCaptureRef.current) {
          try {
            await barcodeCaptureRef.current.setEnabled(isEnabled);
            logInfo(`Scanner ${isEnabled ? 'enabled' : 'disabled'}`);
          } catch (e) {
            logError('Could not update barcode capture state', e);
          }
        }
        
        if (contextRef.current?.frameSource) {
          try {
            await contextRef.current.frameSource.switchToDesiredState(
              isEnabled ? FrameSourceState.On : FrameSourceState.Off
            );
            logInfo(`Camera ${isEnabled ? 'started' : 'stopped'}`);
          } catch (e) {
            logError('Could not update camera state', e);
          }
        }
      } catch (error) {
        logError('Error updating scanner state', error);
      }
    };
    
    updateScannerState();
  }, [isEnabled, isInitialized]);

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
      
      {error && !isCameraAccessError && !isResourceError && (
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
                <li>قم بتحديث الصفحة</li>
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