import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

interface PointsCardProps {
  points: number;
}

export default function PointsCard({ points }: PointsCardProps) {
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
