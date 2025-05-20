import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionManagement } from "@/components/account/session-management";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Shield, User } from "lucide-react";
import { useStore } from "@/store";
import { Redirect } from "wouter";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isInitialized } = useStore();

  // Fetch user data to ensure it's up to date
  const { data: userData, isLoading } = useQuery({
    queryKey: ['/api/users/me'],
    enabled: !!user,
  });

  useEffect(() => {
    // Set page title
    document.title = "إعدادات الحساب | برنامج مكافآت بريق";
  }, []);

  // Redirect to login if not authenticated
  if (isInitialized && !user) {
    return <Redirect to="/auth/login" />;
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">إعدادات الحساب</h1>
        <p className="text-muted-foreground">
          إدارة حسابك وجلسات تسجيل الدخول
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User profile card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>معلومات الحساب</CardTitle>
              <CardDescription>عرض وتحديث معلومات حسابك</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userData && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">الاسم</p>
                      <p className="text-sm text-muted-foreground">{userData.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">رقم الهاتف</p>
                      <p className="text-sm text-muted-foreground" dir="ltr">{userData.phone}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">المنطقة</p>
                      <p className="text-sm text-muted-foreground">{userData.region}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">نوع الحساب</p>
                      <p className="text-sm text-muted-foreground">
                        {userData.role === "installer" ? "فني تركيب" : 
                         userData.role === "admin" ? "مسؤول" : userData.role}
                      </p>
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" className="w-full sm:w-auto" disabled>
                  تحديث المعلومات
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Security settings card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>الأمان</CardTitle>
              <CardDescription>إدارة إعدادات الأمان لحسابك</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">طرق تسجيل الدخول</p>
                <ul className="space-y-2 mt-2">
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="text-sm">رسائل SMS</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="text-sm">واتساب</span>
                  </li>
                </ul>
              </div>
              
              <div className="flex justify-end">
                <Button variant="outline" className="w-full sm:w-auto" disabled>
                  تغيير إعدادات الأمان
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session management */}
      <SessionManagement />
    </div>
  );
}