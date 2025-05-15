import { useEffect, useRef, useState } from "react";
import InstallerLayout from "@/components/layouts/installer-layout";

/**
 * Advanced scanner page – powered by Scandit Web SDK
 * Note: Scandit modules are pulled dynamically via CDN import-map (see index.html).
 *       TS doesn’t know their types at build-time, so we use the `any` escape hatch.
 */
export default function AdvancedScanPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<'initialized' | 'failed' | null>(null);

  useEffect(() => {
    document.title = "مسح متقدم | برنامج مكافآت بريق";

    let dispose: (() => Promise<void>) | undefined;

    (async () => {
      try {
        /* Dynamically import the two SDK packages loaded via the CDN */
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
          FrameSourceState
        } = core as any;

        const {
          BarcodeCapture,
          barcodeCaptureLoader,
          BarcodeCaptureSettings,
          Symbology,
          SymbologyDescription
        } = barcode as any;

        /* Initialise the engine (downloads WASM files automatically) */
        console.log("Using license key from environment secret");
        await configure({
          licenseKey: import.meta.env.VITE_SCANDIT_LICENSE_KEY || "",
          libraryLocation:
            "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7.2.1/sdc-lib/",
          moduleLoaders: [barcodeCaptureLoader()]
        });
        
        // Update license status
        setLicenseStatus('initialized');

        /* Set up capture context & view */
        const context = await DataCaptureContext.create();
        const view    = new DataCaptureView();
        await view.setContext(context);
        view.connectToElement(scannerRef.current!);

        /* Camera */
        const camera = Camera.default;
        await context.setFrameSource(camera);
        await camera.switchToDesiredState(FrameSourceState.On);

        /* Capture only QR codes */
        const settings = new BarcodeCaptureSettings();
        settings.enableSymbologies([Symbology.QR]);

        const capture = await BarcodeCapture.forContext(context, settings);
        capture.addListener({
          didScan: async (_mode: any, session: any) => {
            const code = session.newlyRecognizedBarcode;
            if (!code) return;
            const symDesc = new SymbologyDescription(code.symbology);
            setResult(`${code.data ?? ""} (${symDesc.readableName})`);
          }
        });
        await capture.setEnabled(true);

        /* Provide disposer so we shut everything down on unmount */
        dispose = async () => {
          await capture.setEnabled(false);
          await context.dispose();
        };
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "فشل إعداد الماسح");
        setLicenseStatus('failed');
      }
    })();

    return () => {
      if (dispose) dispose().catch(console.error);
    };
  }, []);

  return (
    <InstallerLayout activeTab="advanced-scan">
      {/* Full height container */}
      <div className="flex flex-col h-[calc(100dvh-4.5rem)]">
        {/* Header */}
        <div className="px-4 py-3 bg-white shadow-sm z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">المسح المتقدم (Scandit)</h1>
            
            {/* License Status Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xs">حالة الترخيص:</span>
              <div className={`h-2.5 w-2.5 rounded-full ${
                licenseStatus === 'initialized' ? 'bg-green-500' : 
                licenseStatus === 'failed' ? 'bg-red-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-xs">
                {licenseStatus === 'initialized' ? 'مفعّل' : 
                 licenseStatus === 'failed' ? 'فشل التفعيل' : 'جاري التحميل...'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Scanner viewport - flex-grow to take all available space */}
        <div className="flex-1 relative">
          <div
            ref={scannerRef}
            className="absolute inset-0 bg-black overflow-hidden"
          />
        </div>

        {/* Results/Status Bar */}
        <div className="px-4 py-3 bg-white shadow-inner">
          {result && (
            <p className="text-green-600 font-medium text-sm py-1">تم المسح: {result}</p>
          )}
          {error && <p className="text-red-600 font-medium text-sm py-1">{error}</p>}
          {!result && !error && (
            <p className="text-gray-500 text-sm py-1">قم بتوجيه الكاميرا نحو رمز QR للمنتج</p>
          )}
          
          {/* Environment info (only visible in dev mode) */}
          {import.meta.env.DEV && (
            <div className="mt-2 p-2 bg-gray-100 rounded-lg text-xs">
              <p className="font-mono">License Key: {import.meta.env.VITE_SCANDIT_LICENSE_KEY ? 'From Environment' : 'Missing'}</p>
            </div>
          )}
        </div>
      </div>
    </InstallerLayout>
  );
}
