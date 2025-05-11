import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import PointsCard from "@/components/installer/points-card";
import AchievementCard from "@/components/installer/achievement-card";
import TransactionsList from "@/components/installer/transactions-list";
import RewardsModal from "@/components/installer/rewards-modal";
import { Reward, Transaction } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function InstallerDashboard() {
  const { user } = useAuth();
  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);

  // Fetch user's transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}`],
    enabled: !!user?.id,
  });

  // Fetch available rewards
  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: [`/api/rewards?userId=${user?.id}`],
    enabled: !!user?.id,
  });

  // Fetch user's badges (preventing duplicates with a stable query key)
  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => apiRequest('GET', `/api/badges?userId=${user?.id}`).then(res => res.json()),
    enabled: !!user?.id,
  });

  const handleRedeemClick = () => {
    setRewardsModalOpen(true);
  };

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
          <PointsCard points={user.points} onRedeemClick={handleRedeemClick} />
        )}
      </section>

      {/* Achievement Card */}
      <section className="px-4 mb-8">
        {badgesLoading ? (
          <Skeleton className="h-80 w-full rounded-2xl" />
        ) : (
          <AchievementCard
            points={user.points}
            level={user.level || 1}
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

      {/* Rewards Modal */}
      {rewardsData && (
        <RewardsModal
          open={rewardsModalOpen}
          onOpenChange={setRewardsModalOpen}
          userPoints={user.points}
          rewards={rewardsData.rewards ? rewardsData.rewards : []}
          userId={user.id}
        />
      )}
    </InstallerLayout>
  );
}
