import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-provider";
import AdminLayout from "@/components/layouts/admin-layout";
import OverviewCards from "@/components/admin/overview-cards";
import InviteForm from "@/components/admin/invite-form";
import UsersTable from "@/components/admin/users-table";
import PointsAllocationForm from "@/components/admin/points-allocation-form";
import ProductsManagement from "@/components/admin/products-management";
import { User, TransactionType } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Fetch users data
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: [`/api/admin/users?userId=${user?.id}`],
    enabled: !!user?.id && user.role === "admin",
  });

  // Fetch transactions data
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}`],
    enabled: !!user?.id && user.role === "admin",
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  // Calculate overview stats
  const installers = usersData?.users ? usersData.users.filter((u: User) => u.role === "installer") : [];
  const totalInstallers = installers.length;
  
  // Normally these would come from actual data, but for now we'll estimate
  const totalInstallations = Math.round(totalInstallers * 2.5); // Assuming average of 2.5 installations per installer

  const transactions = transactionsData?.transactions ? transactionsData.transactions : [];
  const pointsAwarded = transactions
    .filter((t: any) => t.type === TransactionType.EARNING)
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const pointsRedeemed = transactions
    .filter((t: any) => t.type === TransactionType.REDEMPTION)
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const handleUserAction = (action: string, userId: number) => {
    setSelectedUserId(userId);
    if (action === "points") {
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
            <OverviewCards
              totalUsers={totalInstallers}
              totalInstallations={totalInstallations}
              pointsAwarded={pointsAwarded || 0}
              pointsRedeemed={pointsRedeemed || 0}
            />
          )}

          {/* User Invite Form */}
          <InviteForm onSuccess={() => {}} />

          {/* Recent Users Table */}
          {usersLoading ? (
            <Skeleton className="h-96 rounded-xl mb-6" />
          ) : (
            <UsersTable
              users={usersData?.users ? usersData.users.slice(0, 5) : []}
              onViewAll={() => setActiveTab("users")}
              onUserAction={handleUserAction}
            />
          )}

          {/* Points Allocation Form */}
          <PointsAllocationForm 
            users={installers}
            onSuccess={() => {}}
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
          onSuccess={() => setActiveTab("overview")}
        />
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
    </AdminLayout>
  );
}
