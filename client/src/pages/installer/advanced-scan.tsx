
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, QrCode } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { validate as uuidValidate, version as uuidVersion } from "uuid";
import { useToast } from "@/hooks/use-toast";

// Verify UUID v4
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

export default function AdvancedScanPage() {
  const { user, refreshUser } = useAuth();
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    document.title = "مسح متقدم | برنامج مكافآت بريق";
    
    // Load Scandit SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/scandit-sdk@7.2.2/build/browser/index.min.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = async () => {
      try {
        // Initialize Scandit SDK
        // Replace this with your actual license key
        await window.ScanditSDK.configure("YOUR-LICENSE-KEY-HERE", {
          engineLocation: "https://cdn.jsdelivr.net/npm/scandit-sdk@7.2.2/build/engine"
        });
      } catch (error) {
        console.error("Failed to initialize Scandit SDK:", error);
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const startScanning = async () => {
    try {
      const scanner = await window.ScanditSDK.BarcodePicker.create(scannerContainerRef.current!, {
        playSoundOnScan: true,
        vibrateOnScan: true,
        scanSettings: new window.ScanditSDK.ScanSettings({
          enabledSymbologies: ["qr"],
          codeDuplicateFilter: 1000
        })
      });

      scanner.on("scan", async (scanResult) => {
        const code = scanResult.barcodes[0];
        if (code) {
          await validateQrCode(code.data);
        }
      });

      scanner.setMirrorAxis("none");
      await scanner.resumeScanning();
    } catch (error) {
      console.error("Failed to start scanner:", error);
      toast({
        title: "خطأ",
        description: "فشل في تشغيل الماسح الضوئي. يرجى التأكد من منح إذن الكاميرا.",
        variant: "destructive",
      });
    }
  };

  const validateQrCode = async (url: string) => {
    // URL validation logic
    const warrantyUrlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    const shortUrlRegex = /^https:\/\/w\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
    
    const warrantyMatch = url.match(warrantyUrlRegex);
    const shortMatch = url.match(shortUrlRegex);
    
    if (!warrantyMatch && !shortMatch) {
      toast({
        title: "خطأ",
        description: "صيغة رمز QR غير صالحة. يرجى مسح رمز ضمان صالح.",
        variant: "destructive",
      });
      return;
    }

    const uuid = warrantyMatch ? warrantyMatch[1] : shortMatch![1];
    
    if (!isValidUUIDv4(uuid)) {
      toast({
        title: "خطأ",
        description: "رمز المنتج UUID غير صالح",
        variant: "destructive",
      });
      return;
    }

    try {
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
        toast({
          title: "خطأ",
          description: result.message,
          variant: "destructive",
        });
        return;
      }
      
      // Success handling
      refreshUser();
      toast({
        title: "تم التحقق من المنتج بنجاح ✓",
        description: `المنتج: ${result.productName || "غير معروف"}\nالنقاط المكتسبة: ${result.pointsAwarded || 10}`,
      });
      
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التحقق من المنتج",
        variant: "destructive",
      });
    }
  };

  return (
    <InstallerLayout activeTab="advanced-scan">
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">المسح المتقدم</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>المسح المتقدم باستخدام Scandit</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={scannerContainerRef} className="w-full aspect-[4/3] bg-black rounded-lg overflow-hidden mb-4">
              <div className="flex items-center justify-center h-full text-white">
                <QrCode className="w-16 h-16 opacity-20" />
              </div>
            </div>
            
            <Button 
              onClick={startScanning} 
              className="w-full"
              size="lg"
            >
              <Camera className="mr-2 h-5 w-5" />
              بدء المسح المتقدم
            </Button>
          </CardContent>
        </Card>
      </div>
    </InstallerLayout>
  );
}

// Add TypeScript declarations for Scandit SDK
declare global {
  interface Window {
    ScanditSDK: any;
  }
}
