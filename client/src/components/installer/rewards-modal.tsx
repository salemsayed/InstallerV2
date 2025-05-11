import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatNumber } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Reward } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface RewardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userPoints: number;
  rewards: Reward[];
  userId: number;
}

export default function RewardsModal({ 
  open, 
  onOpenChange, 
  userPoints,
  rewards,
  userId
}: RewardsModalProps) {
  const { toast } = useToast();
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  
  const handleRedeemReward = async () => {
    if (!selectedReward) {
      toast({
        title: "يرجى اختيار مكافأة",
        description: "يجب اختيار مكافأة للاستبدال",
        variant: "destructive",
      });
      return;
    }
    
    if (userPoints < selectedReward.points) {
      toast({
        title: "نقاط غير كافية",
        description: "ليس لديك نقاط كافية لاستبدال هذه المكافأة",
        variant: "destructive",
      });
      return;
    }
    
    setIsRedeeming(true);
    
    try {
      const res = await apiRequest("POST", `/api/rewards/redeem?userId=${userId}`, {
        rewardId: selectedReward.id
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "تم الاستبدال بنجاح",
          description: `تم استبدال "${selectedReward.name}" بنجاح`,
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/users/me?userId=${userId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${userId}`] });
        
        onOpenChange(false);
      } else {
        toast({
          title: "فشل الاستبدال",
          description: data.message || "حدث خطأ أثناء استبدال المكافأة",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "فشل الاستبدال",
        description: "حدث خطأ أثناء استبدال المكافأة",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">استبدال النقاط</DialogTitle>
          <DialogDescription>
            اختر المكافأة التي ترغب في استبدالها مقابل نقاطك
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-6">
          <div className="p-4 bg-neutral-100 rounded-lg mb-4">
            <p className="text-center">رصيدك الحالي</p>
            <p className="text-primary text-3xl font-bold text-center">{formatNumber(userPoints)}</p>
          </div>
        </div>
        
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {rewards.length === 0 ? (
            <div className="text-center p-4 text-neutral-500">
              <p>لا توجد مكافآت متاحة حالياً</p>
            </div>
          ) : (
            rewards.map(reward => (
              <div 
                key={reward.id}
                onClick={() => setSelectedReward(reward)}
                className={`border rounded-lg p-4 cursor-pointer transition ${
                  selectedReward?.id === reward.id 
                    ? "border-primary" 
                    : "border-neutral-200 hover:border-primary"
                } ${userPoints < reward.points ? "opacity-50" : ""}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium mb-1">{reward.name}</h3>
                    <p className="text-sm text-neutral-500">{reward.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-primary">{formatNumber(reward.points)}</span>
                    <span className="block text-sm text-neutral-500">نقطة</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <DialogFooter>
          <Button 
            onClick={handleRedeemReward}
            disabled={!selectedReward || userPoints < (selectedReward?.points || 0) || isRedeeming}
            className="w-full"
          >
            {isRedeeming ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ الاستبدال...
              </>
            ) : (
              "استبدال المكافأة"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
