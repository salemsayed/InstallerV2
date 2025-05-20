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
import arOnlyLogo from "@assets/AR-Only.png"; // Import the logo

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

  // Check if user exists in local state
  useEffect(() => {
    console.log("Dashboard mounting, user:", user);
    
    // Don't do anything if user already exists
    if (user) {
      console.log("User is already loaded, no need to reload");
      return;
    }
    
    // Otherwise, check localStorage once
    const hasCheckedStorage = sessionStorage.getItem('hasCheckedUserStorage');
    if (hasCheckedStorage === 'true') {
      console.log("Already checked localStorage once, won't check again");
      return;
    }
    
    // Mark that we've checked localStorage
    sessionStorage.setItem('hasCheckedUserStorage', 'true');
    
    // Check if user exists in localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("Found user in localStorage:", parsedUser);
        // Reload once to load the user from localStorage
        window.location.reload();
      } catch (e) {
        console.error("Error parsing stored user:", e);
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

  // Try to use stored user data if user context is not available
  // This happens when auth provider hasn't fully initialized
  if (!user) {
    // Check sessionStorage for just logged in flag
    const justLoggedIn = sessionStorage.getItem("justLoggedIn");
    
    // Check for user data in localStorage 
    const storedUser = localStorage.getItem("user");
    
    // If we have stored user data, use it directly to render the page
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        
        // Use the stored user data directly for this render
        console.log("Using stored user data directly:", parsedUser);
        
        // Render the dashboard directly with the local user data
        return (
          <div className="min-h-screen bg-neutral-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
              <div className="px-4 py-5 flex justify-between items-center">
                <img src={arOnlyLogo} alt="بريق" className="h-10" />
                
                {/* Profile Button */}
                <div className="rounded-full w-10 h-10 bg-neutral-100 flex items-center justify-center">
                  <span className="material-icons">person</span>
                </div>
              </div>
            </header>
            
            {/* Main Content */}
            <main className="pb-20">
              {/* Welcome Section */}
              <section className="px-4 py-6">
                <h1 className="text-2xl font-bold mb-1">{parsedUser.name || "مرحباً"}</h1>
                <p className="text-neutral-600">مرحباً بك في برنامج مكافآت بريق</p>
              </section>

              {/* Points Card */}
              <section className="px-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-medium mb-2">رصيد النقاط</h2>
                  <div className="flex items-center">
                    <span className="text-3xl font-bold text-primary">{parsedUser.points || 0}</span>
                    <span className="text-neutral-500 mr-2">نقطة</span>
                  </div>
                </div>
              </section>

              {/* Loading Message */}
              <section className="px-4 mb-8 text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">جاري تحميل البيانات...</p>
              </section>
            </main>
            
            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex items-center justify-around py-3 px-6">
              <div className="w-1/3">
                <div className="flex flex-col items-center cursor-pointer text-primary">
                  <span className="material-icons">home</span>
                  <span className="text-xs mt-1">الرئيسية</span>
                </div>
              </div>
              
              <div className="w-1/3">
                <div className="flex flex-col items-center cursor-pointer text-neutral-500">
                  <span className="material-icons">insights</span>
                  <span className="text-xs mt-1">الإحصائيات</span>
                </div>
              </div>
              
              <div className="w-1/3">
                <div className="flex flex-col items-center cursor-pointer text-neutral-500">
                  <span className="material-icons">person</span>
                  <span className="text-xs mt-1">الملف الشخصي</span>
                </div>
              </div>
            </nav>
          </div>
        );
      } catch (e) {
        console.error("Error parsing stored user:", e);
      }
    }
    
    // Show loading screen
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center p-6 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">{storedUser || justLoggedIn ? "جاري تحميل البيانات..." : "يرجى الانتظار..."}</p>
          {!storedUser && !justLoggedIn && (
            <a href="/auth/login" className="inline-block mt-4 text-primary underline">
              العودة لصفحة تسجيل الدخول
            </a>
          )}
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
