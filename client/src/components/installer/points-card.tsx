import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";

interface PointsCardProps {
  points: number;
  isLoading?: boolean;
}

export function PointsCardSkeleton() {
  return (
    <Card className="bg-primary/80 text-white rounded-2xl border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        
        <div className="flex items-end">
          <div className="w-full">
            <Skeleton className="h-10 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PointsCard({ points, isLoading = false }: PointsCardProps) {
  if (isLoading) {
    return <PointsCardSkeleton />;
  }
  
  return (
    <Card className="bg-primary text-white rounded-2xl border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">رصيدك الحالي</h2>
          <span className="material-icons">stars</span>
        </div>
        
        <div className="flex items-end">
          <div>
            <span className="block text-4xl font-bold mb-1">{formatNumber(points)}</span>
            <span className="text-sm opacity-90">نقطة مكافأة</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
