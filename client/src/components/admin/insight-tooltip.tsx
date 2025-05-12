import { useState, useEffect } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/auth-provider";

interface InsightTooltipProps {
  chartType: string;
  dataPoints: any[];
  metric: string;
  dateRange?: DateRange;
  trigger?: React.ReactNode;
  className?: string;
}

export function InsightTooltip({
  chartType,
  dataPoints,
  metric,
  dateRange,
  trigger,
  className,
}: InsightTooltipProps) {
  const { user } = useAuth();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  const fetchInsight = async () => {
    if (!dataPoints.length) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Format date range for API request
      const formattedDateRange = dateRange && dateRange.from && {
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd')
      };
      
      const res = await apiRequest("POST", `/api/analytics/insight?userId=${user?.id || 0}`, {
        chartType,
        dataPoints,
        dateRange: formattedDateRange,
        metric
      });
      
      const data = await res.json();
      
      if (data.success && data.insight) {
        setInsight(data.insight);
      } else {
        setError(data.message || "Failed to generate insight");
      }
    } catch (err) {
      console.error("Error fetching insight:", err);
      setError("حدث خطأ أثناء توليد التحليل");
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch insight when tooltip is opened and not already loaded
  useEffect(() => {
    if (open && !insight && !loading && !error) {
      fetchInsight();
    }
  }, [open, insight, loading, error]);
  
  // Reset insight when data changes significantly
  useEffect(() => {
    setInsight(null);
    setError(null);
  }, [chartType, metric, dateRange]);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          {trigger || (
            <Button 
              variant="ghost" 
              size="icon" 
              className={className}
              aria-label="Show AI insight"
            >
              <Lightbulb className="h-4 w-4" />
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent className="w-80 p-4" side="bottom">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <h4 className="font-semibold text-sm">تحليل ذكي</h4>
            </div>
            
            {loading && (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            
            {insight && !loading && (
              <p className="text-sm" dir="rtl">{insight}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}