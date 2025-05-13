import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Transaction, TransactionType } from "@shared/schema";
import { formatDate, formatNumber } from "@/lib/utils";
import { useMemo } from "react";

interface TransactionsListProps {
  transactions: Transaction[];
  onViewAll?: () => void;
  limit?: number;
  showTotal?: boolean;
}

export default function TransactionsList({ 
  transactions, 
  onViewAll, 
  limit = 5, 
  showTotal = true 
}: TransactionsListProps) {
  
  // Get the most recent transactions up to the limit
  const visibleTransactions = useMemo(() => {
    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    // Return only up to the limit
    return sortedTransactions.slice(0, limit);
  }, [transactions, limit]);
  
  // Total number of transactions
  const totalTransactions = transactions.length;
  
  return (
    <Card className="rounded-2xl shadow-sm border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-medium">آخر المعاملات</h2>
            {showTotal && totalTransactions > 0 && (
              <p className="text-sm text-neutral-500 mt-1">
                {totalTransactions} معاملة إجمالية
              </p>
            )}
          </div>
          {onViewAll && totalTransactions > limit && (
            <Button variant="link" onClick={onViewAll} className="text-primary p-0">
              عرض الكل
            </Button>
          )}
        </div>
        
        {totalTransactions === 0 ? (
          <div className="text-center p-4 text-neutral-500">
            <span className="material-icons text-3xl mb-2">receipt_long</span>
            <p>لا توجد معاملات حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTransactions.map(transaction => (
              <div 
                key={transaction.id} 
                className="flex items-center justify-between py-2 border-b border-neutral-200"
              >
                <div className="flex items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center ml-3 ${
                      transaction.type === TransactionType.EARNING 
                        ? "bg-secondary/10" 
                        : "bg-amber-100"
                    }`}
                  >
                    <span 
                      className={`material-icons ${
                        transaction.type === TransactionType.EARNING 
                          ? "text-secondary" 
                          : "text-amber-600"
                      }`}
                    >
                      {transaction.type === TransactionType.EARNING ? "add_circle" : "redeem"}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium">{transaction.description}</h3>
                    <p className="text-sm text-neutral-500">
                      {transaction.createdAt ? formatDate(transaction.createdAt) : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span 
                    className={`font-bold ${
                      transaction.type === TransactionType.EARNING 
                        ? "text-green-600" 
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type === TransactionType.EARNING ? "+" : "-"}{formatNumber(transaction.amount)}
                  </span>
                  <p className="text-sm text-neutral-500">نقطة</p>
                </div>
              </div>
            ))}
            
            {totalTransactions > limit && (
              <div className="text-center pt-2">
                <Button 
                  variant="outline" 
                  onClick={onViewAll} 
                  className="w-full text-primary border-primary/30 hover:bg-primary/5"
                >
                  عرض كل المعاملات ({totalTransactions})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
