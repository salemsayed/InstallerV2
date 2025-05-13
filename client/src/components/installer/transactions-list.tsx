import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Transaction, TransactionType } from "@shared/schema";
import { formatDate, formatNumber } from "@/lib/utils";
import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface TransactionsListProps {
  transactions: Transaction[];
  onViewAll?: () => void;
  limit?: number;
  showTotal?: boolean;
  showPagination?: boolean;
}

export default function TransactionsList({ 
  transactions, 
  onViewAll, 
  limit = 5, 
  showTotal = true,
  showPagination = false
}: TransactionsListProps) {
  // Add pagination state when pagination is enabled
  const [currentPage, setCurrentPage] = useState(0);
  
  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  
  // Calculate pagination information
  const totalPages = Math.ceil(sortedTransactions.length / limit);
  
  // Get visible transactions based on whether pagination is enabled
  const visibleTransactions = showPagination
    ? sortedTransactions.slice(currentPage * limit, (currentPage + 1) * limit)
    : sortedTransactions.slice(0, limit);
  
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
            
            {/* Pagination Controls */}
            {showPagination && totalPages > 1 ? (
              <div className="flex justify-between items-center gap-2 pt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="flex items-center justify-center gap-1"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span>السابق</span>
                </Button>
                
                <span className="text-sm text-gray-500">
                  {currentPage + 1} من {totalPages}
                </span>
                
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="flex items-center justify-center gap-1"
                >
                  <span>التالي</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              /* View All Button */
              totalTransactions > limit && onViewAll && (
                <div className="text-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={onViewAll} 
                    className="w-full text-primary border-primary/30 hover:bg-primary/5"
                  >
                    عرض المزيد من المعاملات ({totalTransactions})
                  </Button>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
