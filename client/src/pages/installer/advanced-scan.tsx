import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth-provider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import InstallerLayout from "@/components/layouts/installer-layout";
import SimpleScanditScanner from "@/components/installer/simple-scandit-scanner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, QrCode, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";

export default function AdvancedScanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isScannerEnabled, setScannerEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState("scan");
  const [scanditInitFailed, setScanditInitFailed] = useState(false);
  const [scannedData, setScannedData] = useState<{
    data: string;
    symbology: string;
    timestamp: Date;
    processed: boolean;
    result?: { success: boolean; message: string; points?: number; productName?: string; };
  } | null>(null);
  
  // Fetch Scandit license key
  const { 
    data: scanditData,
    isLoading: isScanditKeyLoading,
    isError: isScanditKeyError,
    error: scanditKeyError
  } = useQuery({
    queryKey: [`/api/scandit/license-key?userId=${user?.id}`],
    enabled: !!user?.id,
  });

  // Scan QR code mutation
  const { mutate: processQrCode, isPending: isProcessing } = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/scan-qr", { qrCode: code });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "فشل في معالجة الكود");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("[Scandit Advanced] QR Processing success:", data);
      if (scannedData) {
        setScannedData({
          ...scannedData,
          processed: true,
          result: {
            success: true,
            message: data.message,
            points: data.points,
            productName: data.productName
          }
        });
      }
      
      toast({
        title: "تم المسح بنجاح",
        description: data.message,
        variant: "default",
      });
      
      // Re-enable scanner after successful scan
      setTimeout(() => {
        setScannerEnabled(true);
      }, 2000);
    },
    onError: (error: Error) => {
      console.error("[Scandit Advanced] QR Processing error:", error);
      if (scannedData) {
        setScannedData({
          ...scannedData,
          processed: true,
          result: {
            success: false,
            message: error.message
          }
        });
      }
      
      toast({
        title: "خطأ في المسح",
        description: error.message,
        variant: "destructive",
      });
      
      // Re-enable scanner even after error
      setTimeout(() => {
        setScannerEnabled(true);
      }, 2000);
    }
  });

  const handleScanSuccess = (data: string, symbology: string) => {
    console.log(`[Scandit Advanced] Scan successful - Data: ${data}, Symbology: ${symbology}`);
    setScannerEnabled(false);
    
    // Store scan result
    const newScan = {
      data,
      symbology,
      timestamp: new Date(),
      processed: false
    };
    setScannedData(newScan);
    setActiveTab("result");
    
    // Process QR code
    processQrCode(data);
  };

  const resetScanner = () => {
    setScannedData(null);
    setActiveTab("scan");
    setScannerEnabled(true);
  };

  useEffect(() => {
    // Reset page title
    document.title = "المسح المتقدم | برنامج مكافآت بريق";
  }, []);

  return (
    <InstallerLayout activeTab="advanced-scan">
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">المسح المتقدم</h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">
              <QrCode className="ml-2 h-4 w-4" />
              الماسح
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!scannedData}>
              <CheckCircle2 className="ml-2 h-4 w-4" />
              النتيجة
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="scan" className="mt-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle>ماسح Scandit المتقدم</CardTitle>
                <CardDescription>
                  قم بتوجيه الكاميرا نحو رمز QR للمنتج
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-0">
                {isScanditKeyLoading ? (
                  <div className="flex flex-col items-center justify-center bg-gray-100 py-12 px-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-center">جاري تحميل ماسح Scandit المتقدم...</p>
                  </div>
                ) : isScanditKeyError ? (
                  <div className="flex flex-col items-center justify-center bg-gray-100 py-12 px-4 text-center">
                    <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="font-bold text-red-600 mb-2">فشل تحميل ماسح Scandit</h3>
                    <p className="text-gray-600 mb-4">
                      {scanditKeyError instanceof Error ? scanditKeyError.message : 'حدث خطأ أثناء تحميل مفتاح ترخيص Scandit'}
                    </p>
                    <Button 
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                    >
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : scanditData?.success && scanditData?.licenseKey ? (
                  <SimpleScanditScanner 
                    onScanSuccess={handleScanSuccess}
                    onError={(error) => {
                      toast({
                        title: "خطأ في تحميل ماسح Scandit",
                        description: error.message,
                        variant: "destructive"
                      });
                      setScannerInitFailed(true);
                    }}
                    isEnabled={isScannerEnabled}
                    className="w-full" 
                    licenseKey={scanditData.licenseKey}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center bg-gray-100 py-12 px-4 text-center">
                    <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="font-bold text-red-600 mb-2">مفتاح ترخيص غير متوفر</h3>
                    <p className="text-gray-600">
                      لم يتم العثور على مفتاح ترخيص Scandit
                    </p>
                  </div>
                )}
                
                {scanditInitFailed && 
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-80 py-12 px-4 text-center text-white">
                    <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="font-bold text-white text-xl mb-2">فشل تحميل مكتبة Scandit</h3>
                    <p className="text-gray-200 mb-6">
                      واجهنا مشكلة في الوصول إلى مكتبات Scandit. قد يكون ذلك بسبب اتصال الإنترنت أو إعدادات المتصفح.
                    </p>
                    <Button 
                      onClick={() => window.location.reload()}
                      variant="default"
                      size="lg"
                    >
                      إعادة المحاولة
                    </Button>
                  </div>
                }
              </CardContent>
              
              <CardFooter className="flex justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  باستخدام تقنية Scandit للمسح الضوئي
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="result" className="mt-4">
            {scannedData && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>نتيجة المسح</CardTitle>
                  <CardDescription>
                    {scannedData.symbology} - {new Date(scannedData.timestamp).toLocaleTimeString('ar-EG')}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {isProcessing ? (
                    <div className="flex flex-col items-center py-6">
                      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                      <p>جاري التحقق من المنتج...</p>
                    </div>
                  ) : scannedData.processed && scannedData.result ? (
                    <div className="space-y-4">
                      <div className="flex items-start">
                        {scannedData.result.success ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500 ml-2 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-6 w-6 text-red-500 ml-2 flex-shrink-0" />
                        )}
                        <div>
                          <h3 className={`font-medium ${scannedData.result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {scannedData.result.success ? 'تم المسح بنجاح' : 'فشل المسح'}
                          </h3>
                          <p className="text-gray-600">{scannedData.result.message}</p>
                        </div>
                      </div>
                      
                      {scannedData.result.success && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          {scannedData.result.productName && (
                            <div className="flex justify-between mb-2">
                              <span className="font-medium">المنتج:</span>
                              <span>{scannedData.result.productName}</span>
                            </div>
                          )}
                          {scannedData.result.points && (
                            <div className="flex justify-between">
                              <span className="font-medium">النقاط:</span>
                              <span className="text-primary font-bold">{scannedData.result.points}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium">رمز QR:</span>
                          <span className="font-mono text-sm text-gray-600 truncate max-w-[200px]" dir="ltr">
                            {scannedData.data}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-6">
                      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                      <p>جاري معالجة المسح...</p>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter>
                  <Button 
                    onClick={resetScanner} 
                    className="w-full"
                    variant="default"
                  >
                    مسح جديد
                  </Button>
                </CardFooter>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </InstallerLayout>
  );
}