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
      await configure({
        licenseKey: licenseKey,
        moduleLoaders: [barcodeCaptureLoader()],
        libraryLocation: new URL('node_modules/@scandit/web-datacapture-barcode/sdc-lib/', window.location.origin).href,
      });
      
      view.hideProgressBar();
      
      logInfo('Creating DataCaptureContext...');
      // Create the data capture context
      const context = await DataCaptureContext.create();
      contextRef.current = context;
      
      // Set the context to the view
      await view.setContext(context);
      
      logInfo('Initializing camera...');
      // Initialize camera
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
          
          const symbology = new SymbologyDescription(barcode.symbology);
          const data = barcode.data || '';
          
          logInfo(`Barcode scanned: ${data} (${symbology.readableName})`);
          
          // Pause scanning while processing
          await barcodeCapture.setEnabled(false);
          
          // Call the onScanSuccess callback with scan data
          onScanSuccess(data, symbology.readableName);
          
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
      
      // Start the camera
      if (isEnabled) {
        await context.frameSource?.switchToDesiredState(FrameSourceState.On);
        logInfo('Camera started');
      }
      
      setIsInitialized(true);
      logInfo('Scandit scanner initialization complete');
      
    } catch (error: any) {
      logError('Failed to initialize scanner', error);
    }
  };

  useEffect(() => {
    initializeScanner();
    
    // Cleanup function
    return () => {
      const cleanupScanner = async () => {
        logInfo('Cleaning up scanner resources...');
        try {
          // Disable barcode capture
          if (barcodeCaptureRef.current) {
            await barcodeCaptureRef.current.setEnabled(false);
            logInfo('Barcode capture disabled');
          }
          
          // Turn off camera
          if (contextRef.current?.frameSource) {
            await contextRef.current.frameSource.switchToDesiredState(FrameSourceState.Off);
            logInfo('Camera turned off');
          }
          
          // Dispose of context
          if (contextRef.current) {
            await contextRef.current.dispose();
            contextRef.current = null;
            logInfo('Context disposed');
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
          await barcodeCaptureRef.current.setEnabled(isEnabled);
          logInfo(`Scanner ${isEnabled ? 'enabled' : 'disabled'}`);
        }
        
        if (contextRef.current?.frameSource) {
          await contextRef.current.frameSource.switchToDesiredState(
            isEnabled ? FrameSourceState.On : FrameSourceState.Off
          );
          logInfo(`Camera ${isEnabled ? 'started' : 'stopped'}`);
        }
      } catch (error) {
        logError('Error updating scanner state', error);
      }
    };
    
    updateScannerState();
  }, [isEnabled, isInitialized]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={containerRef} 
        className="w-full h-full min-h-[60vh] bg-black"
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white p-4 text-center">
          <div>
            <p className="text-red-500 font-bold mb-2">حدث خطأ في تشغيل الماسح</p>
            <p>{error}</p>
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