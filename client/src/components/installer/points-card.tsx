import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

interface PointsCardProps {
  points: number;
  onRedeemClick: () => void;
}

export default function PointsCard({ points, onRedeemClick }: PointsCardProps) {
  return (
    <Card className="bg-primary text-white rounded-2xl border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">رصيدك الحالي</h2>
          <span className="material-icons">stars</span>
        </div>
        
        <div className="flex justify-between items-end">
          <div>
            <span className="block text-4xl font-bold mb-1">{formatNumber(points)}</span>
            <span className="text-sm opacity-90">نقطة مكافأة</span>
          </div>
          
          <Button 
            onClick={onRedeemClick}
            className="bg-white text-primary hover:bg-white/90 hover:text-primary"
          >
            استبدال النقاط
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
