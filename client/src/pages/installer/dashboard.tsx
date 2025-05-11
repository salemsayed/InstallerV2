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

export default function InstallerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's transactions with aggressive refresh settings
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}`],
    enabled: !!user?.id,
    staleTime: 0, // Always consider data stale
    refetchInterval: 3000, // Refetch every 3 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  // Fetch user's badges with aggressive refresh settings
  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => apiRequest('GET', `/api/badges?userId=${user?.id}`).then(res => res.json()),
    enabled: !!user?.id,
    staleTime: 0, // Always consider data stale
    refetchInterval: 3000, // Refetch every 3 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  
  // Refresh user data from auth context regularly
  useQuery({
    queryKey: ['/api/users/me'],
    enabled: !!user?.id,
    staleTime: 0, // Always consider data stale
    refetchInterval: 3000, // Refetch every 3 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  if (!user) {
    return null;
  }

  return (
    <InstallerLayout>
      {/* Welcome Section */}
      <section className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
        <p className="text-neutral-600">مرحباً بك في برنامج مكافآت بريق</p>
      </section>

      {/* Points Card */}
      <section className="px-4 mb-8">
        {!user ? (
          <Skeleton className="h-36 w-full rounded-2xl" />
        ) : (
          <PointsCard points={user.points} />
        )}
      </section>

      {/* Achievement Card */}
      <section className="px-4 mb-8">
        {badgesLoading ? (
          <Skeleton className="h-80 w-full rounded-2xl" />
        ) : (
          <AchievementCard
            points={user.points}
            badges={badgesData?.badges ? badgesData.badges : []}
          />
        )}
      </section>

      {/* Recent Transactions */}
      <section className="px-4 mb-8">
        {transactionsLoading ? (
          <Skeleton className="h-60 w-full rounded-2xl" />
        ) : (
          <TransactionsList 
            transactions={transactionsData?.transactions ? transactionsData.transactions : []} 
            onViewAll={() => {/* Implement view all transactions */}}
          />
        )}
      </section>
      
      {/* QR Scanner - no need for onScanSuccess since the component handles page reload */}
      <QrScanner />
    </InstallerLayout>
  );
}
