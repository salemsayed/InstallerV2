import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-provider";
import { useTooltips } from "@/hooks/use-tooltips";
import AdminLayout from "@/components/layouts/admin-layout";
import OverviewCards from "@/components/admin/overview-cards";
import InviteForm from "@/components/admin/invite-form";
import UsersTable from "@/components/admin/users-table";
import PointsAllocationForm from "@/components/admin/points-allocation-form";
import ProductsManagement from "@/components/admin/products-management";
import BadgesManagement from "@/components/admin/badges-management";
import EditUserDialog from "@/components/admin/edit-user-dialog";
import DeleteConfirmationDialog from "@/components/admin/delete-confirmation-dialog";
import { User, TransactionType } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import TooltipTrigger from "@/components/ui/tooltip-trigger";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { startTour } = useTooltips();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Start the tour for first-time admin users
  useEffect(() => {
    if (user?.role === "admin") {
      // Wait for the UI to render before showing tooltips
      const tourTimer = setTimeout(() => {
        startTour([
          'dashboard-overview',
          'users-management',
          'points-allocation',
          'badges-management'
        ]);
      }, 1000);
      
      return () => clearTimeout(tourTimer);
    }
  }, [startTour, user?.role]);

  // Fetch users data
  const { 
    data: usersData, 
    isLoading: usersLoading,
    refetch: refetchUsers
  } = useQuery({
    queryKey: [`/api/admin/users?userId=${user?.id}`],
    enabled: !!user?.id && user.role === "admin",
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch transactions data for ALL users (admin-specific endpoint)
  const { 
    data: transactionsData, 
    isLoading: transactionsLoading,
    refetch: refetchTransactions 
  } = useQuery({
    queryKey: [`/api/admin/transactions?userId=${user?.id}`],
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
  
  // Fetch badges data
  const { 
    data: badgesData, 
    isLoading: badgesLoading,
    refetch: refetchBadges
  } = useQuery({
    queryKey: [`/api/badges?userId=${user?.id}`],
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
  
  console.log("DEBUG: Total transactions received:", transactions.length);
  console.log("DEBUG: All transactions:", JSON.stringify(transactions));
  
  // First, let's log the API response data
  console.log("DEBUG: Raw transactions data:", JSON.stringify(transactionsData));
  
  // Let's examine what's in the transaction array
  if (transactions.length > 0) {
    console.log("DEBUG: First transaction sample:", JSON.stringify(transactions[0]));
    console.log("DEBUG: First transaction type:", transactions[0].type);
    console.log("DEBUG: First transaction date:", transactions[0].createdAt);
  }
  
  const installationTransactions = transactions.filter((t: any) => {
    // Log every transaction we're examining for debugging
    console.log(`DEBUG: Examining transaction: id=${t.id}, type=${t.type}, date=${t.createdAt}`);
    
    // First check if it's an earning transaction
    if (t.type !== TransactionType.EARNING) {
      console.log(`DEBUG: Transaction ${t.id} rejected - not an EARNING type`);
      return false;
    }
    
    // Then check if it's from the current month
    let transactionDate;
    try {
      transactionDate = new Date(t.createdAt);
      console.log(`DEBUG: Transaction ${t.id} date parsed as:`, 
        transactionDate.toISOString(), 
        `Month: ${transactionDate.getMonth()}, Year: ${transactionDate.getFullYear()}`);
    } catch (e) {
      console.error(`DEBUG: Error parsing date for transaction ${t.id}:`, e);
      return false;
    }
    
    const isCurrentMonth = (
      transactionDate.getMonth() === currentMonth && 
      transactionDate.getFullYear() === currentYear
    );
    
    console.log(`DEBUG: Transaction ${t.id} current month check:`, 
      isCurrentMonth,
      `(${transactionDate.getMonth()} === ${currentMonth} && ${transactionDate.getFullYear()} === ${currentYear})`
    );
    
    return isCurrentMonth;
  });
  
  console.log("DEBUG: Current month/year:", currentMonth, currentYear);
  console.log("DEBUG: Filtered installation transactions:", installationTransactions.length);
  console.log("DEBUG: Installation transactions:", JSON.stringify(installationTransactions));
  
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
          {/* Overview Cards */}
          {usersLoading || transactionsLoading ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : (
            <TooltipTrigger id="dashboard-overview">
              <div className="w-full">
                <OverviewCards
                  totalUsers={totalInstallers}
                  totalInstallations={totalInstallations}
                  pointsAwarded={pointsAwarded || 0}
                  pointsRedeemed={pointsRedeemed || 0}
                />
              </div>
            </TooltipTrigger>
          )}

          {/* User Invite Form */}
          <TooltipTrigger id="users-management">
            <div className="w-full">
              <InviteForm onSuccess={() => {}} />
            </div>
          </TooltipTrigger>

          {/* Recent Users Table */}
          {usersLoading ? (
            <Skeleton className="h-96 rounded-xl mb-6" />
          ) : (
            <TooltipTrigger id="users-table">
              <div className="w-full">
                <UsersTable
                  users={usersData?.users ? usersData.users.slice(0, 5) : []}
                  onViewAll={() => setActiveTab("users")}
                  onUserAction={handleUserAction}
                />
              </div>
            </TooltipTrigger>
          )}

          {/* Points Allocation Form */}
          <TooltipTrigger id="points-allocation">
            <div className="w-full">
              <PointsAllocationForm 
                users={installers}
                onSuccess={() => {
                  refetchUsers();
                  refetchTransactions();
                }}
              />
            </div>
          </TooltipTrigger>
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
            <TooltipTrigger id="badges-management">
              <div className="w-full">
                <BadgesManagement
                  badges={badgesData?.badges || []}
                  onRefresh={refetchBadges}
                  userId={user?.id}
                />
              </div>
            </TooltipTrigger>
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

      {activeTab === "stats" && (
        <div className="text-center p-8 text-neutral-500">
          <span className="material-icons text-6xl mb-4">insights</span>
          <h2 className="text-xl font-bold mb-2">قريباً</h2>
          <p>ستتمكن من عرض إحصائيات مفصلة قريباً</p>
        </div>
      )}
      
      {activeTab === "products" && (
        <>
          {productsLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <TooltipTrigger id="products-management">
              <div className="w-full">
                <ProductsManagement
                  products={productsData?.products || []}
                  onRefresh={refetchProducts}
                />
              </div>
            </TooltipTrigger>
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
