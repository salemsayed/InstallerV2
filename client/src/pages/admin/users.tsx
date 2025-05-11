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
import { Loader2 } from "lucide-react";
import { User } from "@shared/schema";

export default function AdminUsers() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("all-users");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  console.log("AdminUsers component rendered, dialog states:", { editDialogOpen, deleteDialogOpen });

  // Fetch users
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<{ users: User[] }>({
    queryKey: [`/api/admin/users?userId=${user?.id}`],
    enabled: !!user && user.role === "admin",
  });

  const handleUserAction = (action: string, userId: number) => {
    console.log("User action triggered:", action, "for userId:", userId);
    
    if (!usersData || !Array.isArray(usersData.users)) {
      console.error("usersData missing or not an array:", usersData);
      return;
    }
    
    const targetUser = usersData.users.find((u: User) => u.id === userId);
    if (!targetUser) {
      console.error("Target user not found for ID:", userId);
      return;
    }
    
    console.log("Found target user:", targetUser);
    
    // Set the selected user first
    setSelectedUser(targetUser);
    
    // Use setTimeout to ensure state updates before dialog opens
    setTimeout(() => {
      switch (action) {
        case "edit":
          console.log("Opening edit dialog for user:", targetUser.name);
          setEditDialogOpen(true);
          break;
        case "delete":
          console.log("Opening delete dialog for user:", targetUser.name);
          setDeleteDialogOpen(true);
          break;
        case "points":
          setActiveTab("add-points");
          break;
        case "view":
          console.log("View user details:", targetUser);
          break;
        default:
          break;
      }
    }, 0);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleSuccess = () => {
    refetchUsers();
  };

  return (
    <AdminLayout activeTab="users" onTabChange={handleTabChange}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">إدارة المستخدمين</h1>
        <p className="text-gray-500 mt-1">إدارة المستخدمين في نظام مكافآت بريق وتخصيص النقاط</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-gray-100/80 backdrop-blur-sm p-1 rounded-xl">
          <TabsTrigger value="all-users" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200">
            المستخدمين
          </TabsTrigger>
          <TabsTrigger value="invite-user" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200">
            إضافة مستخدم
          </TabsTrigger>
          <TabsTrigger value="add-points" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200">
            إضافة نقاط
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all-users" className="pt-6">
          <Card className="rounded-xl shadow-md border border-gray-100 bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-xl font-bold text-primary">قائمة المستخدمين</CardTitle>
              <CardDescription>إدارة مستخدمي بريق المسجلين في النظام</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {usersLoading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-gray-500">جاري تحميل بيانات المستخدمين...</span>
                  </div>
                </div>
              ) : (
                <UsersTable
                  users={usersData && Array.isArray(usersData.users) ? usersData.users : []}
                  onUserAction={handleUserAction}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="invite-user" className="pt-6">
          <InviteForm onSuccess={handleSuccess} />
        </TabsContent>
        
        <TabsContent value="add-points" className="pt-6">
          <Card className="rounded-xl shadow-md border border-gray-100 bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-xl font-bold text-primary">إضافة نقاط</CardTitle>
              <CardDescription>إضافة نقاط للمستخدمين بناءً على الأنشطة المكتملة</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <PointsAllocationForm
                users={usersData && Array.isArray(usersData.users) ? 
                  usersData.users.filter((u: User) => u.role === "installer") : []}
                onSuccess={handleSuccess}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit User Dialog */}
      {editDialogOpen && (
        <EditUserDialog
          user={selectedUser}
          open={editDialogOpen}
          onOpenChange={(open) => {
            console.log("Setting editDialogOpen to:", open);
            setEditDialogOpen(open);
          }}
          onSuccess={handleSuccess}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            console.log("Setting deleteDialogOpen to:", open);
            setDeleteDialogOpen(open);
          }}
          userId={selectedUser?.id || null}
          userName={selectedUser?.name || ""}
          onSuccess={handleSuccess}
        />
      )}
    </AdminLayout>
  );
}