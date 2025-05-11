import { useState } from "react";
import AdminLayout from "@/components/layouts/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // States for form values
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [systemName, setSystemName] = useState("برنامج مكافآت بريق");
  
  // Handle logout
  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
  };
  
  return (
    <AdminLayout activeTab="stats">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>الحساب</CardTitle>
            <CardDescription>إدارة تفاصيل حسابك الإداري</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-row items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-2xl text-white">
                  {user?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-medium">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge className="mt-1">مسؤول</Badge>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" value={user?.email} readOnly disabled />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>إعدادات النظام</CardTitle>
            <CardDescription>تخصيص إعدادات نظام المكافآت</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="system-name">اسم النظام</Label>
              <Input 
                id="system-name" 
                value={systemName} 
                onChange={(e) => setSystemName(e.target.value)} 
              />
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications">الإشعارات عبر البريد الإلكتروني</Label>
                <Switch 
                  id="email-notifications" 
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                إرسال إشعارات عبر البريد الإلكتروني للفنيين عند إضافة النقاط أو إرسال الدعوات
              </p>
            </div>
            
            <Button className="w-full mt-2">حفظ الإعدادات</Button>
          </CardContent>
        </Card>
        
        <Separator />
        
        <Button 
          variant="destructive" 
          className="w-full" 
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "جاري تسجيل الخروج..." : "تسجيل الخروج"}
        </Button>
      </div>
    </AdminLayout>
  );
}