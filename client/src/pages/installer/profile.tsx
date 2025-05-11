import { useState } from "react";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Transaction, Badge as BadgeType } from "@shared/schema";

export default function InstallerProfile() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Get badges data
  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => user?.id ? apiRequest('GET', `/api/badges?userId=${user.id}`).then(res => res.json()) : null,
    enabled: !!user?.id,
  });
  
  // Fetch user's transactions to calculate accurate points balance
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}`],
    enabled: !!user?.id,
  });
  
  // Calculate actual points balance from transactions (same as on stats page and dashboard)
  // Filter transactions by type
  const earningTransactions = transactionsData?.transactions?.filter(t => t.type === 'earning') || [];
  const redemptionTransactions = transactionsData?.transactions?.filter(t => t.type === 'redemption') || [];
  
  // Calculate total earnings and redemptions
  const totalEarnings = earningTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalRedemptions = redemptionTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate actual points balance (earnings minus redemptions)
  const pointsBalance = totalEarnings - totalRedemptions;
  
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
          </CardHeader>
          <CardContent>
            <div className="text-center">
              {transactionsLoading ? (
                <p className="text-center py-1">جاري التحميل...</p>
              ) : (
                <>
                  <span className="text-2xl font-bold">{pointsBalance}</span>
                  <span className="text-neutral-500 mr-2">نقطة مكافأة</span>
                </>
              )}
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