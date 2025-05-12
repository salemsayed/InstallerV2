import { useState, useEffect } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth-provider";

interface AnalyticsSummaryProps {
  totalInstallers: number;
  totalInstallations: number;
  pointsAwarded: number;
  pointsRedeemed: number;
  regionData: any[];
  productData: any[];
  dateRange?: DateRange;
  className?: string;
}

export function AnalyticsSummary({
  totalInstallers,
  totalInstallations,
  pointsAwarded,
  pointsRedeemed,
  regionData,
  productData,
  dateRange,
  className,
}: AnalyticsSummaryProps) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Format date range for API request
      const formattedDateRange = dateRange && dateRange.from && {
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd')
      };
      
      const res = await apiRequest("POST", `/api/analytics/summary?userId=${user?.id || 0}`, {
        totalInstallers,
        totalInstallations,
        pointsAwarded,
        pointsRedeemed,
        regionData,
        productData,
        dateRange: formattedDateRange
      });
      
      const data = await res.json();
      
      if (data.success && data.summary) {
        setSummary(data.summary);
      } else {
        setError(data.message || "Failed to generate summary");
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
      setError("حدث خطأ أثناء توليد الملخص");
    } finally {
      setLoading(false);
    }
  };
  
  // Reset summary when data changes significantly
  useEffect(() => {
    setSummary(null);
    setError(null);
  }, [dateRange, totalInstallers, totalInstallations, pointsAwarded]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">تحليل ذكي للبيانات</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchSummary}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {error && !loading && (
          <div className="text-sm text-destructive py-2">
            {error}
          </div>
        )}
        
        {summary && !loading && (
          <div className="text-sm" dir="rtl">
            {summary}
          </div>
        )}
        
        {!summary && !loading && !error && (
          <div className="text-sm text-muted-foreground py-2 text-center" dir="rtl">
            اضغط على أيقونة المصباح لتوليد تحليل ذكي للبيانات
          </div>
        )}
      </CardContent>
    </Card>
  );
}