import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layouts/admin-layout";
import UsersTable from "@/components/admin/users-table";
import InviteForm from "@/components/admin/invite-form";
import PointsAllocationForm from "@/components/admin/points-allocation-form";
import EditUserDialog from "@/components/admin/edit-user-dialog";
import DeleteConfirmationDialog from "@/components/admin/delete-confirmation-dialog";
import { useAuth } from "@/hooks/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User } from "@shared/schema";

export default function AdminUsers() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("all-users");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch users
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<{ users: User[] }>({
    queryKey: ['/api/admin/users'],
    enabled: !!user && user.role === "admin",
  });

  const handleUserAction = (action: string, userId: number) => {
    if (!usersData || !Array.isArray(usersData.users)) return;
    
    const targetUser = usersData.users.find((u: User) => u.id === userId);
    if (!targetUser) return;
    
    setSelectedUser(targetUser);
    
    switch (action) {
      case "edit":
        setEditDialogOpen(true);
        break;
      case "delete":
        setDeleteDialogOpen(true);
        break;
      case "points":
        setActiveTab("add-points");
        break;
      case "view":
        // Implement user view action if needed
        console.log("View user details:", targetUser);
        break;
      default:
        break;
    }
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
          <TabsTrigger value="invite-user" className="flex-1">إضافة فني</TabsTrigger>
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
                  users={usersData && Array.isArray(usersData.users) ? usersData.users : []}
                  onUserAction={handleUserAction}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="invite-user" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>إضافة فني جديد</CardTitle>
              <CardDescription>إضافة فني جديد إلى نظام مكافآت بريق</CardDescription>
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
                  users={usersData && Array.isArray(usersData.users) ? 
                    usersData.users.filter((u: User) => u.role === "installer") : []}
                  onSuccess={handleSuccess}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit User Dialog */}
      <EditUserDialog
        user={selectedUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
      
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        userId={selectedUser?.id || null}
        userName={selectedUser?.name || ""}
        onSuccess={handleSuccess}
      />
    </AdminLayout>
  );
}