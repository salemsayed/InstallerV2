import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { 
  startOfDay, 
  endOfDay,
  isBefore, 
  isAfter, 
  parseISO, 
  format,
  differenceInDays,
  addDays,
  subDays
} from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { DateRangePicker, DateRangePresets } from "./date-range-picker";
import { InsightTooltip } from "./insight-tooltip";
import { AnalyticsSummary } from "./analytics-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// Define types for API responses to enable proper type checking
interface Transaction {
  id: number;
  userId: number;
  type: string;
  amount: number;
  description: string | null;
  metadata: any;
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  points: number;
  level: number;
  region?: string;
  badgeIds: number[];
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

interface UsersResponse {
  users: User[];
}
import { TransactionType, UserRole } from "@shared/schema";

// Colors for charts
const CHART_COLORS = ["#11a683", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b"];

interface AnalyticsDashboardProps {
  userId?: number;
  isLoading?: boolean;
}

export function AnalyticsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Date Range Picker Skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-72" />
      </div>
      
      {/* Summary Card Skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40 mb-2" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </CardContent>
      </Card>
      
      {/* Charts Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Point Activities Chart Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        
        {/* User Registrations Chart Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        
        {/* Top Products Chart Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        
        {/* User Distribution Chart Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ userId, isLoading = false }: AnalyticsDashboardProps) {
  if (isLoading) {
    return <AnalyticsDashboardSkeleton />;
  }
  // Set default date range to last 30 days
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 29);
  
  // State for date range
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: thirtyDaysAgo,
    to: today
  });
  
  // State for active chart tab
  const [activeChartTab, setActiveChartTab] = useState("installations");
  
  // Fetch transaction data with proper type checking
  // Now using session-based authentication
  const { 
    data: transactionsData, 
    isLoading: transactionsLoading 
  } = useQuery<TransactionsResponse>({
    queryKey: ['/api/admin/transactions'],
    queryFn: () => fetch('/api/admin/transactions').then(res => res.json()),
    enabled: true,
    refetchInterval: 5000,
  });
  
  // Fetch users data with proper type checking
  // Now using session-based authentication
  const { 
    data: usersData, 
    isLoading: usersLoading 
  } = useQuery<UsersResponse>({
    queryKey: ['/api/admin/users'],
    queryFn: () => fetch('/api/admin/users').then(res => res.json()),
    enabled: true,
    refetchInterval: 5000,
  });
  
  // Filter data based on date range
  const transactions = transactionsData && typeof transactionsData === 'object' && transactionsData !== null && 'transactions' in transactionsData 
    ? (transactionsData.transactions as any[]) 
    : [];
    
  const filteredTransactions = transactions.filter((t: any) => {
    if (!dateRange?.from || !dateRange?.to) return true;
    
    const transactionDate = parseISO(t.createdAt);
    const fromDate = startOfDay(dateRange.from);
    const toDate = endOfDay(dateRange.to || dateRange.from);
    
    return (
      isAfter(transactionDate, fromDate) && 
      isBefore(transactionDate, toDate)
    );
  });
  
  // Analysis data
  const users = usersData && typeof usersData === 'object' && usersData !== null && 'users' in usersData
    ? (usersData.users as any[])
    : [];
    
  const totalInstallers = users.filter((u: any) => u.role === UserRole.INSTALLER).length;
  
  const installationTransactions = filteredTransactions.filter((t: any) => t.type === TransactionType.EARNING);
  const totalInstallations = installationTransactions.length;
  
  const pointsAwarded = installationTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
  
  const redemptionTransactions = filteredTransactions.filter((t: any) => t.type === TransactionType.REDEMPTION);
  const pointsRedeemed = redemptionTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
  
  // Generate time series data
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to || !filteredTransactions.length) return;
    
    const days = differenceInDays(dateRange.to || dateRange.from, dateRange.from) + 1;
    const data = [];
    
    // Create a map to store data by date
    const dateMap = new Map();
    
    // Initialize the map with all dates in the range
    for (let i = 0; i < days; i++) {
      const date = addDays(dateRange.from, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      dateMap.set(dateStr, {
        date: dateStr,
        installations: 0,
        points: 0,
        redemptions: 0
      });
    }
    
    // Fill the map with actual data
    for (const transaction of filteredTransactions) {
      const date = format(parseISO(transaction.createdAt), 'yyyy-MM-dd');
      if (!dateMap.has(date)) continue;
      
      const entry = dateMap.get(date);
      
      if (transaction.type === TransactionType.EARNING) {
        entry.installations += 1;
        entry.points += transaction.amount;
      } else if (transaction.type === TransactionType.REDEMPTION) {
        entry.redemptions += transaction.amount;
      }
      
      dateMap.set(date, entry);
    }
    
    // Convert map to array
    const result = Array.from(dateMap.values());
    
    // Sort by date
    result.sort((a, b) => a.date.localeCompare(b.date));
    
    setTimeSeriesData(result);
  }, [dateRange, filteredTransactions]);
  
  // Generate region data with proper null checking
  const regionDistribution = users
    .filter((u: any) => u.role === UserRole.INSTALLER && u.region)
    .reduce((acc: Record<string, {region: string, count: number}>, user: any) => {
      const region = user.region;
      if (!acc[region]) {
        acc[region] = { region, count: 0 };
      }
      acc[region].count += 1;
      return acc;
    }, {} as Record<string, {region: string, count: number}>);
  
  const regionChartData = Object.values(regionDistribution);
  
  // Generate product breakdown data
  const productData = installationTransactions.reduce((acc: any, t: any) => {
    // Extract product name from description (assuming format "تم تركيب منتج [PRODUCT_NAME]")
    const match = t.description?.match(/تم تركيب منتج (.+)/);
    const productName = match ? match[1] : "غير معروف";
    
    if (!acc[productName]) {
      acc[productName] = { name: productName, count: 0, points: 0 };
    }
    
    acc[productName].count += 1;
    acc[productName].points += t.amount;
    
    return acc;
  }, {});
  
  const productChartData = productData ? Object.values(productData) : [];
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">لوحة الإحصائيات المتقدمة</h2>
          <p className="text-muted-foreground">
            تحليلات مفصلة لأداء المركبين والتثبيتات والنقاط
          </p>
        </div>
        
        <div className="w-full md:w-auto">
          <DateRangePicker 
            dateRange={dateRange} 
            onDateRangeChange={setDateRange} 
          />
          <DateRangePresets onSelect={setDateRange} />
        </div>
      </div>
      
      {/* AI-powered Analytics Summary */}
      <AnalyticsSummary
        totalInstallers={totalInstallers}
        totalInstallations={totalInstallations}
        pointsAwarded={pointsAwarded}
        pointsRedeemed={pointsRedeemed}
        regionData={regionDistribution ? Object.entries(regionDistribution).map(([name, value]: [string, any]) => ({ name, count: value.count })) : []}
        productData={productChartData}
        dateRange={dateRange}
        className="mb-2"
      />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              إجمالي المركبين
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="text-3xl font-bold">{totalInstallers}</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              عمليات التركيب
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="text-3xl font-bold">{totalInstallations}</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              النقاط الممنوحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="text-3xl font-bold">{pointsAwarded}</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              النقاط المستبدلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <div className="text-3xl font-bold">{pointsRedeemed}</div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <Tabs value={activeChartTab} onValueChange={setActiveChartTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="installations">عمليات التركيب</TabsTrigger>
          <TabsTrigger value="points">النقاط</TabsTrigger>
          <TabsTrigger value="regions">المناطق</TabsTrigger>
          <TabsTrigger value="products">المنتجات</TabsTrigger>
        </TabsList>
        
        <TabsContent value="installations" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>عمليات التركيب عبر الزمن</CardTitle>
              <InsightTooltip
                chartType="installations_time_series"
                dataPoints={timeSeriesData}
                metric="installations"
                dateRange={dateRange}
              />
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(date) => format(parseISO(date), 'MM/dd')}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => [`${value}`, "عدد التركيبات"]}
                      labelFormatter={(date) => format(parseISO(date), 'yyyy/MM/dd')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="installations" 
                      name="عمليات التركيب" 
                      stroke="#11a683" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="points" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>النقاط الممنوحة والمستبدلة عبر الزمن</CardTitle>
              <InsightTooltip
                chartType="points_time_series"
                dataPoints={timeSeriesData}
                metric="points"
                dateRange={dateRange}
              />
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(date) => format(parseISO(date), 'MM/dd')}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => [`${value}`, "النقاط"]}
                      labelFormatter={(date) => format(parseISO(date), 'yyyy/MM/dd')}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="points" 
                      name="النقاط الممنوحة" 
                      stroke="#3b82f6" 
                      activeDot={{ r: 8 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="redemptions" 
                      name="النقاط المستبدلة" 
                      stroke="#ef4444" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="regions" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>توزيع المركبين حسب المنطقة</CardTitle>
              <InsightTooltip
                chartType="region_distribution"
                dataPoints={regionDistribution ? Object.entries(regionDistribution).map(([name, value]: [string, any]) => ({ name, count: value.count })) : []}
                metric="installers_by_region"
                dateRange={dateRange}
              />
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="flex flex-col lg:flex-row">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={regionChartData}
                        dataKey="count"
                        nameKey="region"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={(entry) => `${entry.region}: ${entry.count}`}
                      >
                        {regionChartData.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[index % CHART_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}`, "المركبين"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div className="mt-4 lg:mt-0 lg:ml-8">
                    <h4 className="font-bold mb-2">توزيع المركبين</h4>
                    <div className="grid gap-2">
                      {regionChartData.map((item: any, index: number) => (
                        <div key={index} className="flex items-center">
                          <div 
                            className="w-4 h-4 mr-2" 
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span>
                            {item.region}: {item.count} مركب
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>توزيع المنتجات المركبة</CardTitle>
              <InsightTooltip
                chartType="product_distribution"
                dataPoints={productChartData}
                metric="installations_by_product"
                dateRange={dateRange}
              />
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value}`, 
                        name === "count" ? "عدد التركيبات" : "النقاط"
                      ]}
                    />
                    <Legend />
                    <Bar 
                      dataKey="count" 
                      name="عدد التركيبات" 
                      fill="#11a683" 
                    />
                    <Bar 
                      dataKey="points" 
                      name="النقاط الممنوحة" 
                      fill="#3b82f6" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}