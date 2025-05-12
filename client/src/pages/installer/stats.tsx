import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import TransactionsList from "@/components/installer/transactions-list";

export default function InstallerStats() {
  const { user } = useAuth();
  
  // Fetch transactions with a higher limit
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}&limit=1000`],
    enabled: !!user?.id,
  });
  
  // Filter transactions by type
  const earningTransactions = transactionsData?.transactions?.filter(t => t.type === 'earning') || [];
  const redemptionTransactions = transactionsData?.transactions?.filter(t => t.type === 'redemption') || [];
  
  // Calculate total earnings and redemptions
  const totalEarnings = earningTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalRedemptions = redemptionTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate actual points balance (earnings minus redemptions)
  const pointsBalance = totalEarnings - totalRedemptions;
  
  return (
    <InstallerLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold text-right">الإحصائيات</h1>
        
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-lg">النقاط المكتسبة</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-center text-green-600">{totalEarnings}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-lg">النقاط المستخدمة</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-center text-red-600">{totalRedemptions}</p>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">رصيد النقاط</CardTitle>
            <CardDescription>إجمالي النقاط المتاحة (المكتسبة - المستخدمة)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-center">{pointsBalance}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>آخر العمليات</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <p className="text-center py-4">جاري التحميل...</p>
            ) : (
              <TransactionsList 
                transactions={transactionsData?.transactions || []} 
              />
            )}
          </CardContent>
        </Card>
      </div>
    </InstallerLayout>
  );
}