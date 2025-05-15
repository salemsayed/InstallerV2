import { useEffect } from "react";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdvancedScanPage() {
  const { user } = useAuth();

  useEffect(() => {
    // Reset page title
    document.title = "مسح متقدم | برنامج مكافآت بريق";
  }, []);

  return (
    <InstallerLayout activeTab="advanced-scan">
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">المسح المتقدم</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>المسح المتقدم</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">هذه الصفحة قيد التطوير وستكون متاحة قريبًا.</p>
          </CardContent>
        </Card>
      </div>
    </InstallerLayout>
  );
}