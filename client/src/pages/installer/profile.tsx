import { useState } from "react";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { calculateLevelProgress } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function InstallerProfile() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Get badges data
  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => user?.id ? apiRequest('GET', `/api/badges?userId=${user.id}`).then(res => res.json()) : null,
    enabled: !!user?.id,
  });
  
  // Get level progress
  const levelProgress = user ? calculateLevelProgress(user.points) : { level: 1, progress: 0, nextLevelPoints: 100 };
  
  // Get user badges
  const userBadges = user?.badgeIds 
    ? badgesData?.badges?.filter(badge => 
        Array.isArray(user.badgeIds) && user.badgeIds.includes(badge.id)
      ) 
    : [];
  
  // Handle logout
  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
  };
  
  return (
    <InstallerLayout>
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="text-center pb-2">
            <Avatar className="w-20 h-20 mx-auto">
              <AvatarFallback className="bg-primary text-2xl text-white">
                {user?.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-2 text-xl">{user?.name}</CardTitle>
            <p className="text-neutral-500">{user?.email}</p>
            <Badge variant="outline" className="mt-1">
              المستوى {levelProgress.level}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-neutral-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{ width: `${levelProgress.progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">{user?.points} نقطة</span>
              <span className="text-neutral-500">{levelProgress.nextLevelPoints} نقطة للمستوى التالي</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">معلومات الحساب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-neutral-500">المنطقة</p>
              <p>{user?.region || "غير محدد"}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">رقم الهاتف</p>
              <p>{user?.phone || "غير محدد"}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الشارات</CardTitle>
          </CardHeader>
          <CardContent>
            {badgesLoading ? (
              <p className="text-center py-4">جاري التحميل...</p>
            ) : userBadges?.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {userBadges.map(badge => (
                  <div key={badge.id} className="flex items-center p-2 border rounded-lg">
                    <span className="material-icons text-primary mr-2">{badge.icon}</span>
                    <div>
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-xs text-neutral-500">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-neutral-500">لا توجد شارات بعد. استمر في العمل الجيد للحصول على شارات!</p>
            )}
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
    </InstallerLayout>
  );
}