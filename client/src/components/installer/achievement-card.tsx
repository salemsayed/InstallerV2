import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface AchievementCardProps {
  points: number;
  badges: {
    id: number;
    name: string;
    icon: string;
    description: string;
    requiredPoints: number;
    minInstallations: number;
    earned: boolean;
  }[];
  isLoading?: boolean;
}

export function AchievementCardSkeleton() {
  return (
    <Card className="rounded-2xl border border-border/50">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map((_, index) => (
            <div key={index} className="flex flex-col items-center">
              <Skeleton className="h-16 w-16 rounded-full mb-2" />
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
        
        <div className="flex justify-center mt-4">
          <Skeleton className="h-8 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AchievementCard({ points, badges, isLoading = false }: AchievementCardProps) {
  if (isLoading) {
    return <AchievementCardSkeleton />;
  }
  const [showAll, setShowAll] = useState(false);
  
  // Filter out duplicates based on badge ID
  const uniqueBadges = badges.reduce((acc, current) => {
    const x = acc.find(item => item.id === current.id);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as typeof badges);
  
  // Separate earned badges from unearned ones
  const earnedBadges = uniqueBadges.filter(badge => badge.earned);
  
  // Get closest unearned badges (to motivate the user)
  // Sort unearned badges by how close the user is to earning them
  const unEarnedBadges = uniqueBadges
    .filter(badge => !badge.earned)
    .map(badge => {
      const pointsPercentage = badge.requiredPoints > 0 
        ? Math.min(100, (points / badge.requiredPoints) * 100) 
        : 0;
        
      // Calculate a "closeness" score - higher means closer to earning
      const closeness = pointsPercentage;
      
      return {
        ...badge,
        pointsPercentage,
        closeness
      };
    })
    .sort((a, b) => b.closeness - a.closeness);
  
  // Display all unearned badges or just the top ones based on showAll state
  const displayUnEarnedBadges = showAll ? unEarnedBadges : unEarnedBadges.slice(0, 3);
  
  return (
    <Card className="rounded-2xl shadow-sm border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium">شارات الإنجاز</h2>
          <span className="material-icons text-accent">emoji_events</span>
        </div>
        
        {earnedBadges.length > 0 ? (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-3 text-primary">شاراتك المكتسبة</h3>
            <div className="grid grid-cols-3 gap-3">
              {earnedBadges.map(badge => (
                <div key={badge.id} className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2 bg-accent/20 relative">
                    <span className="material-icons text-2xl text-accent">{badge.icon}</span>
                    <div className="absolute -top-1 -right-1 bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="material-icons text-sm">check</span>
                    </div>
                  </div>
                  <span className="text-xs text-center font-medium">{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-100 p-3 rounded-lg mb-4 text-center">
            <span className="material-icons text-neutral-500 mb-2">emoji_events</span>
            <p className="text-sm">لم تحصل على أي شارات بعد!</p>
            <p className="text-xs text-neutral-500">قم بمسح منتجات أكثر للحصول على شارات.</p>
          </div>
        )}
        
        {unEarnedBadges.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 text-neutral-600">الشارات القادمة</h3>
            <div className="grid grid-cols-3 gap-3">
              {displayUnEarnedBadges.map(badge => (
                <div key={badge.id} className="flex flex-col items-center group relative">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2 bg-neutral-200 opacity-70 group-hover:opacity-100 transition-opacity relative">
                    <span className="material-icons text-2xl text-neutral-500">{badge.icon}</span>
                    {badge.pointsPercentage > 0 && (
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
                        <circle 
                          className="stroke-primary/30" 
                          fill="none" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          strokeDasharray={`${badge.pointsPercentage}, 100`}
                          transform="rotate(-90 18 18)"
                          cx="18" 
                          cy="18" 
                          r="16" 
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-center text-neutral-700">{badge.name}</span>
                  
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded py-1 px-2 w-32 z-10 pointer-events-none">
                    <p className="text-center mb-1">{badge.description}</p>
                    {badge.requiredPoints > 0 && (
                      <p className="text-xs text-center">{Math.floor(badge.pointsPercentage)}% مكتمل</p>
                    )}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-black"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Only show the button if there are more than 3 unearned badges */}
        {unEarnedBadges.length > 3 && (
          <Button 
            variant="ghost" 
            className="w-full mt-4 text-sm" 
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "إظهار أقل" : "عرض المزيد من الشارات"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
