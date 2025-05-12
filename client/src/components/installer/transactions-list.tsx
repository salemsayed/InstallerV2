import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Transaction, TransactionType } from "@shared/schema";
import { formatDate, formatNumber } from "@/lib/utils";

interface TransactionsListProps {
  transactions: Transaction[];
  onViewAll?: () => void;
  displayLimit?: number; // Limit of transactions to show in the UI
  showPagination?: boolean; // Whether to show pagination controls
}

export default function TransactionsList({ 
  transactions, 
  onViewAll, 
  displayLimit = 5, 
  showPagination = false 
}: TransactionsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(transactions.length / displayLimit);
  
  // Calculate which transactions to display based on current page and display limit
  const startIndex = (currentPage - 1) * displayLimit;
  const endIndex = Math.min(startIndex + displayLimit, transactions.length);
  const displayedTransactions = transactions.slice(startIndex, endIndex);
  
  // Handle pagination
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  return (
    <Card className="rounded-2xl shadow-sm border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium">آخر المعاملات</h2>
          {onViewAll && (
            <Button variant="link" onClick={onViewAll} className="text-primary p-0">
              عرض الكل
            </Button>
          )}
        </div>
        
        {transactions.length === 0 ? (
          <div className="text-center p-4 text-neutral-500">
            <span className="material-icons text-3xl mb-2">receipt_long</span>
            <p>لا توجد معاملات حتى الآن</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Using displayedTransactions instead of all transactions */}
              {displayedTransactions.map(transaction => (
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
                      <p className="text-sm text-neutral-500">{formatDate(transaction.createdAt)}</p>
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
            </div>
            
            {/* Show pagination controls only if enabled and needed */}
            {showPagination && totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 pt-2 border-t border-neutral-200">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToPreviousPage} 
                  disabled={currentPage === 1}
                >
                  السابق
                </Button>
                <span className="text-sm text-neutral-500">
                  الصفحة {currentPage} من {totalPages}
                </span>
                <Button 
                  variant="outline"
                  size="sm" 
                  onClick={goToNextPage} 
                  disabled={currentPage === totalPages}
                >
                  التالي
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
