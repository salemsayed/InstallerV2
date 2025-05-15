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
      <div className="container py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">المسح المتقدم (Scandit)</h1>
          
          {/* License Status Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm">حالة الترخيص:</span>
            <div className={`h-3 w-3 rounded-full ${
              licenseStatus === 'initialized' ? 'bg-green-500' : 
              licenseStatus === 'failed' ? 'bg-red-500' : 'bg-gray-300'
            }`}></div>
            <span className="text-sm">
              {licenseStatus === 'initialized' ? 'مفعّل' : 
               licenseStatus === 'failed' ? 'فشل التفعيل' : 'جاري التحميل...'}
            </span>
          </div>
        </div>
        
        {/* Scanner viewport – 3:4 gives a nice full-screen phone frame */}
        <div
          ref={scannerRef}
          className="w-full aspect-[3/4] bg-black rounded-lg overflow-hidden"
        />

        {result && (
          <p className="text-green-600 font-medium">تم المسح: {result}</p>
        )}
        {error && <p className="text-red-600 font-medium">{error}</p>}
        
        {/* Environment info (only visible in dev mode) */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-xs">
            <p className="font-mono">License Key Used: {import.meta.env.VITE_SCANDIT_LICENSE_KEY ? 'From Environment' : 'Missing (fallback to empty string)'}</p>
          </div>
        )}
      </div>
    </InstallerLayout>
  );
}
