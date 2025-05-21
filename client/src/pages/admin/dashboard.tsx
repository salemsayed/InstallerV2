import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-provider";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/layouts/admin-layout";
import OverviewCards from "@/components/admin/overview-cards";
import UsersTable from "@/components/admin/users-table";
import PointsAllocationForm from "@/components/admin/points-allocation-form";
import ProductsManagement from "@/components/admin/products-management";
import BadgesManagement from "@/components/admin/badges-management";
import AnalyticsDashboard from "@/components/admin/analytics-dashboard";
import EditUserDialog from "@/components/admin/edit-user-dialog";
import DeleteConfirmationDialog from "@/components/admin/delete-confirmation-dialog";
import { User, TransactionType } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  
  console.log("[admin] Current user state:", user);
  console.log("[admin] User role:", user?.role);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch users data - userId now derived from session on server
  const { 
    data: usersData, 
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers
  } = useQuery({
    queryKey: [`/api/admin/users`],
    queryFn: async () => {
      console.log("[admin] Fetching users data...");
      const res = await apiRequest('GET', '/api/admin/users');
      const data = await res.json();
      console.log("[admin] Users data response:", data);
      return data;
    },
    enabled: user?.role === "admin",
    refetchInterval: 5000,
    retry: 2,
    onError: (error) => {
      console.error("[admin] Error fetching users:", error);
    }
  });

  // Fetch transactions data for ALL users (admin-specific endpoint)
  const { 
    data: transactionsData, 
    isLoading: transactionsLoading,
    refetch: refetchTransactions 
  } = useQuery({
    queryKey: [`/api/admin/transactions`],
    queryFn: () => apiRequest('GET', '/api/admin/transactions').then(res => res.json()),
    enabled: !!user?.id && user.role === "admin",
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
  
  // Note: We no longer need to fetch scanned products since we're using transaction data for installation count
  
  // Fetch products data
  const { 
    data: productsData, 
    isLoading: productsLoading,
    refetch: refetchProducts
  } = useQuery({
    queryKey: ['/api/products'],
    enabled: !!user?.id && user.role === "admin",
  });
  
  // Fetch badges data - userId now derived from session on server
  const { 
    data: badgesData, 
    isLoading: badgesLoading,
    refetch: refetchBadges
  } = useQuery({
    queryKey: [`/api/badges`],
    queryFn: () => apiRequest('GET', '/api/badges').then(res => res.json()),
    enabled: !!user?.id && user.role === "admin",
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  // Get transaction data
  const transactions = transactionsData?.transactions ? transactionsData.transactions : [];
  
  // Calculate overview stats
  const installers = usersData?.users ? usersData.users.filter((u: User) => u.role === "installer") : [];
  const totalInstallers = installers.length;
  
  // Count earning transactions from the current month as installations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Filter for installation transactions from the current month
  const installationTransactions = transactions.filter((t: any) => {
    // Check if it's an earning transaction
    if (t.type !== TransactionType.EARNING) {
      return false;
    }
    
    // Check if it's from the current month (safely parse the date)
    let transactionDate;
    try {
      transactionDate = new Date(t.createdAt);
      // Handle potential timezone issues by using UTC methods for comparison
      const transactionMonth = transactionDate.getUTCMonth();
      const transactionYear = transactionDate.getUTCFullYear();
      
      // Compare with current month/year (also in UTC)
      return (
        transactionMonth === now.getUTCMonth() && 
        transactionYear === now.getUTCFullYear()
      );
    } catch (e) {
      // If date parsing fails, exclude this transaction
      return false;
    }
  });
  
  const totalInstallations = installationTransactions.length;
  const pointsAwarded = transactions
    .filter((t: any) => t.type === TransactionType.EARNING)
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const pointsRedeemed = transactions
    .filter((t: any) => t.type === TransactionType.REDEMPTION)
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const handleUserAction = (action: string, userId: number) => {
    // Find the user in the users array
    const targetUser = usersData?.users?.find((u: User) => u.id === userId);
    
    setSelectedUserId(userId);
    
    if (action === "edit" && targetUser) {
      setSelectedUser(targetUser);
      setIsEditDialogOpen(true);
    } else if (action === "delete" && targetUser) {
      setSelectedUser(targetUser);
      setIsDeleteDialogOpen(true);
    } else if (action === "points") {
      setActiveTab("points");
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "overview" && (
        <>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary mb-1">لوحة الإحصائيات</h1>
            <p className="text-gray-500">عرض تحليلي للبيانات وإحصائيات التركيب والنقاط</p>
          </div>
          <AnalyticsDashboard 
            userId={user?.id} 
            isLoading={transactionsLoading || usersLoading || productsLoading} 
          />
        </>
      )}

      {activeTab === "users" && (
        <>
          {usersLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <UsersTable
              users={usersData?.users ? usersData.users : []}
              onUserAction={handleUserAction}
            />
          )}
        </>
      )}

      {activeTab === "points" && (
        <PointsAllocationForm 
          users={installers}
          onSuccess={() => {
            refetchUsers();
            refetchTransactions();
            setActiveTab("overview");
          }}
        />
      )}

      {activeTab === "badges" && (
        <>
          {badgesLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <BadgesManagement
              badges={badgesData?.badges || []}
              onRefresh={refetchBadges}
              userId={user?.id}
            />
          )}
        </>
      )}

      {activeTab === "rewards" && (
        <div className="text-center p-8 text-neutral-500">
          <span className="material-icons text-6xl mb-4">card_giftcard</span>
          <h2 className="text-xl font-bold mb-2">قريباً</h2>
          <p>ستتمكن من إدارة المكافآت المتاحة قريباً</p>
        </div>
      )}


      
      {activeTab === "products" && (
        <>
          {productsLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <ProductsManagement
              products={productsData?.products || []}
              onRefresh={refetchProducts}
            />
          )}
        </>
      )}

      {/* Edit User Dialog */}
      <EditUserDialog
        user={selectedUser}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          setSelectedUser(null);
          refetchUsers(); // Refresh user data
        }}
      />
      
      {/* Delete User Dialog */}
      <DeleteConfirmationDialog
        userId={selectedUser?.id || null}
        userName={selectedUser?.name || ""}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onSuccess={() => {
          setIsDeleteDialogOpen(false);
          setSelectedUser(null);
          refetchUsers(); // Refresh user data
        }}
      />
    </AdminLayout>
  );
}
