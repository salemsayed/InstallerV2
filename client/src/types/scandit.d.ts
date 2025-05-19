/**
 * Type declarations for Scandit SDK modules
 * These are minimal declarations to satisfy TypeScript requirements
 */

declare module '@scandit/web-datacapture-core' {
  export class DataCaptureContext {
    static forLicenseKey(licenseKey: string): DataCaptureContext;
    setFrameSource(frameSource: any): Promise<void>;
    addMode(mode: any): void;
    dispose(): void;
  }

  export class Camera {
    static default: Camera;
    static getCameras(): Promise<Camera[]>;
    applySettings(settings: CameraSettings): Promise<void>;
  }

  export class CameraSettings {
    preferredResolution: any;
    constructor();
  }

  export class VideoResolution {
    static HD: any;
  }

  export class DataCaptureView {
    constructor(context: DataCaptureContext);
    connectToElement(element: HTMLElement): void;
  }

  export class Rect {
    constructor(x: number, y: number, width: number, height: number);
  }

  export class RectangularViewfinder {
    constructor();
  }

  export class LaserlineViewfinder {
    constructor();
  }

  export class BrushBuilder {
    constructor();
    setColor(color: string): this;
    build(): any;
  }
  
  export const Brush: any;
}

declare module '@scandit/web-datacapture-barcode' {
  import { DataCaptureContext, Rect } from '@scandit/web-datacapture-core';
  
  export class BarcodeCaptureSettings {
    constructor();
    enableSymbology(symbology: any, enabled: boolean): void;
    enableSymbologies(symbologies: any[], enabled: boolean): void;
    setProperty(name: string, value: any): void;
  }

  export class BarcodeCapture {
    static forContext(context: DataCaptureContext, settings: BarcodeCaptureSettings): BarcodeCapture;
    isEnabled: boolean;
    addListener(listener: any): void;
    applySettings(settings: BarcodeCaptureSettings): Promise<void>;
  }

  export class BarcodeCaptureOverlay {
    static withBarcodeCaptureForView(barcodeCapture: BarcodeCapture, view: any): BarcodeCaptureOverlay;
    viewfinder: any;
  }

  export const Symbology: {
    QR: any;
    AZTEC: any;
    CODE128: any;
    CODE39: any;
    DATA_MATRIX: any;
    EAN13: any;
    EAN8: any;
    PDF417: any;
    UPCA: any;
    UPCE: any;
  };

  export class SymbologySettings {
    isEnabled: boolean;
    enableExtension(extension: any, enabled: boolean): void;
  }

  export interface BarcodeCaptureListener {
    didScan(barcodeCapture: BarcodeCapture, session: { newlyRecognizedBarcodes: any[] }): void;
  }
}