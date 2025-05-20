import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/auth-provider";
import InstallerLayout from "@/components/layouts/installer-layout";
import PointsCard from "@/components/installer/points-card";
import AchievementCard from "@/components/installer/achievement-card";
import TransactionsList from "@/components/installer/transactions-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@shared/schema";

// Define proper types for the API responses
interface TransactionsResponse {
  transactions: Transaction[];
  totalCount: number;
}

interface BadgesResponse {
  badges: Array<{ id: number; name: string; description: string; imageUrl: string; points: number; active: boolean }>;
}

export default function InstallerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load user data from localStorage if not available in context
  useEffect(() => {
    console.log("Dashboard mounting, user:", user);
    
    // If no user in context but exists in localStorage, load it directly
    if (!user) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log("Loading user from localStorage:", parsedUser);
          // This will trigger a re-render with the user data
          window.location.reload();
        } catch (e) {
          console.error("Error parsing stored user:", e);
        }
      }
    }
  }, [user]);

  // Use default data if API calls fail
  const defaultTransactions: Transaction[] = [];
  const defaultBadges = [];
  
  // Fetch user's transactions with proper error handling
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<TransactionsResponse>({
    queryKey: [`/api/transactions?userId=${user?.id}&limit=100`],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  // Fetch user's badges with proper error handling
  const { data: badgesData, isLoading: badgesLoading } = useQuery<BadgesResponse>({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => apiRequest('GET', `/api/badges?userId=${user?.id}`).then(res => res.json()),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  
  // Ensure user data is up to date
  useQuery({
    queryKey: ['/api/users/me'],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  // Check for authenticated user and handle loading state
  if (!user) {
    // Check if user might be in local storage but not yet in state
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        // If we have a stored user but it's not in state yet, show loading
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل البيانات...</p>
            </div>
          </div>
        );
      } catch (e) {
        // If parsing fails, show login button
      }
    }
    
    // If no stored user, show login message
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <span className="material-icons text-4xl text-primary mb-2">account_circle</span>
          <h1 className="text-xl font-semibold mb-2">جلسة غير مصرح بها</h1>
          <p className="text-gray-600 mb-4">يرجى تسجيل الدخول لعرض لوحة التحكم الخاصة بك</p>
          <a href="/auth/login" className="inline-block bg-primary text-white px-6 py-2 rounded-md">
            تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }
  
  // Process transaction data safely with fallbacks
  const transactions = transactionsData?.transactions || [];
  const earningTransactions = transactions.filter((t: Transaction) => t.type === 'earning');
  const redemptionTransactions = transactions.filter((t: Transaction) => t.type === 'redemption');
  
  // Calculate totals
  const totalEarnings = earningTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
  const totalRedemptions = redemptionTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
  
  // Calculate actual points balance
  const pointsBalance = totalEarnings - totalRedemptions;

  // Set a fallback array of badges for display if the API fails to return badges
  const defaultBadgesForDisplay = [
    {
      id: 1,
      name: "مثبت جديد",
      icon: "emoji_events",
      description: "قم بتثبيت منتج واحد",
      requiredPoints: 50,
      minInstallations: 1,
      earned: false
    },
    {
      id: 2,
      name: "مثبت متميز",
      icon: "star",
      description: "قم بتثبيت 5 منتجات",
      requiredPoints: 250,
      minInstallations: 5,
      earned: false
    },
    {
      id: 3,
      name: "مثبت محترف",
      icon: "workspace_premium",
      description: "قم بتثبيت 10 منتجات",
      requiredPoints: 500,
      minInstallations: 10,
      earned: false
    }
  ];
  
  // Use default badges if API fails to return data
  const transformedBadges = badgesData?.badges ? 
    // Transform API response to match component's expected format
    badgesData.badges.map(badge => ({
      id: badge.id,
      name: badge.name,
      icon: "emoji_events", // Default icon
      description: badge.description,
      requiredPoints: badge.points,
      minInstallations: 1, // Default value
      earned: badge.active // We use the 'active' property to determine if badge is earned
    })) : 
    // Use default badges if API fails
    defaultBadgesForDisplay;

  return (
    <InstallerLayout>
      {/* Welcome Section */}
      <section className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
        <p className="text-neutral-600">مرحباً بك في برنامج مكافآت بريق</p>
      </section>

      {/* Points Card */}
      <section className="px-4 mb-8">
        <PointsCard 
          points={transactionsLoading ? user.points : pointsBalance} 
          isLoading={transactionsLoading}
        />
      </section>

      {/* Achievement Card */}
      <section className="px-4 mb-8">
        <AchievementCard
          points={user.points}
          badges={transformedBadges}
          isLoading={badgesLoading}
        />
      </section>

      {/* Recent Transactions */}
      <section className="px-4 mb-8">
        <TransactionsList 
          transactions={transactions} 
          onViewAll={() => window.location.href = "/installer/stats"}
          limit={5}
          showTotal={true}
          isLoading={transactionsLoading}
        />
      </section>
      
      {/* Scan button is now in layout */}
    </InstallerLayout>
  );
}
