import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import UsersTable from "@/components/admin/users-table";
import InviteForm from "@/components/admin/invite-form";
import PointsAllocationForm from "@/components/admin/points-allocation-form";
import { useAuth } from "@/hooks/auth-provider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminUsers() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("all-users");

  // Fetch users
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    enabled: !!user && user.role === "admin",
  });

  const handleUserAction = (action: string, userId: number) => {
    console.log(`Action: ${action}, User ID: ${userId}`);
    // Implement user actions here
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleSuccess = () => {
    refetchUsers();
  };

  return (
    <AdminLayout activeTab="users" onTabChange={handleTabChange}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="all-users" className="flex-1">الفنيين</TabsTrigger>
          <TabsTrigger value="invite-user" className="flex-1">دعوة فني</TabsTrigger>
          <TabsTrigger value="add-points" className="flex-1">إضافة نقاط</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all-users" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>قائمة الفنيين</CardTitle>
              <CardDescription>إدارة فنيي بريق المسجلين في النظام</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center p-6">جاري التحميل...</div>
              ) : (
                <UsersTable
                  users={usersData?.users || []}
                  onUserAction={handleUserAction}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="invite-user" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>دعوة فني جديد</CardTitle>
              <CardDescription>إرسال دعوة للانضمام إلى نظام مكافآت بريق</CardDescription>
            </CardHeader>
            <CardContent>
              {user && (
                <InviteForm
                  adminId={user.id}
                  onSuccess={handleSuccess}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="add-points" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>إضافة نقاط للفنيين</CardTitle>
              <CardDescription>مكافأة الفنيين على الأعمال المنجزة</CardDescription>
            </CardHeader>
            <CardContent>
              {user && (
                <PointsAllocationForm
                  adminId={user.id}
                  users={usersData?.users?.filter(u => u.role === "installer") || []}
                  onSuccess={handleSuccess}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}