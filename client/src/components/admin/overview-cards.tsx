import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

interface OverviewCardProps {
  title: string;
  value: number;
  icon: string;
}

function OverviewCard({ title, value, icon }: OverviewCardProps) {
  return (
    <Card className="rounded-xl shadow-sm border-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-neutral-600">{title}</h3>
          <span className="material-icons text-primary">{icon}</span>
        </div>
        <p className="text-2xl font-bold">{formatNumber(value)}</p>
      </CardContent>
    </Card>
  );
}

interface OverviewCardsProps {
  totalUsers: number;
  totalInstallations: number;
  pointsAwarded: number;
  pointsRedeemed: number;
}

export default function OverviewCards({
  totalUsers,
  totalInstallations,
  pointsAwarded,
  pointsRedeemed
}: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <OverviewCard
        title="إجمالي الفنيين"
        value={totalUsers}
        icon="people"
      />
      
      <OverviewCard
        title="التركيبات هذا الشهر"
        value={totalInstallations}
        icon="construction"
      />
      
      <OverviewCard
        title="النقاط الممنوحة"
        value={pointsAwarded}
        icon="paid"
      />
      
      <OverviewCard
        title="النقاط المستبدلة"
        value={pointsRedeemed}
        icon="redeem"
      />
    </div>
  );
}
