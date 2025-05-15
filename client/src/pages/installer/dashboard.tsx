import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import PointsCard from "@/components/installer/points-card";
import AchievementCard from "@/components/installer/achievement-card";
import TransactionsList from "@/components/installer/transactions-list";
import QrScanner from "@/components/installer/qr-scanner";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@shared/schema";

export default function InstallerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's transactions with frequent refresh and higher limit
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}&limit=100`],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 2000 // Refresh every 2 seconds
  });

  // Fetch user's badges with frequent refresh
  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => apiRequest('GET', `/api/badges?userId=${user?.id}`).then(res => res.json()),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 2000 // Refresh every 2 seconds
  });
  
  // Keep user data fresh with frequent refresh
  useQuery({
    queryKey: ['/api/users/me'],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 2000 // Refresh every 2 seconds
  });

  if (!user) {
    return null;
  }
  
  // Calculate actual points balance from transactions (same as on stats page)
  // Filter transactions by type
  const transactions = transactionsData?.transactions || [];
  const earningTransactions = transactions.filter((t: Transaction) => t.type === 'earning');
  const redemptionTransactions = transactions.filter((t: Transaction) => t.type === 'redemption');
  
  // Calculate total earnings and redemptions
  const totalEarnings = earningTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
  const totalRedemptions = redemptionTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
  
  // Calculate actual points balance (earnings minus redemptions)
  const pointsBalance = totalEarnings - totalRedemptions;

  return (
    <InstallerLayout>
      {/* Welcome Section */}
      <section className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
        <p className="text-neutral-600">مرحباً بك في برنامج مكافآت بريق</p>
      </section>

      {/* Points Card */}
      <section className="px-4 mb-8">
        <PointsCard 
          points={transactionsLoading ? user.points : pointsBalance} 
          isLoading={transactionsLoading}
        />
      </section>

      {/* Achievement Card */}
      <section className="px-4 mb-8">
        <AchievementCard
          points={user.points}
          badges={badgesData?.badges ? badgesData.badges : []}
          isLoading={badgesLoading}
        />
      </section>

      {/* Recent Transactions */}
      <section className="px-4 mb-8">
        <TransactionsList 
          transactions={transactions} 
          onViewAll={() => window.location.href = "/installer/stats"}
          limit={5}
          showTotal={true}
          isLoading={transactionsLoading}
        />
      </section>
      
      {/* QR Scanner - no need for onScanSuccess since the component handles page reload */}
      <QrScanner />
    </InstallerLayout>
  );
}
