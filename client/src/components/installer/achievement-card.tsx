import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@shared/schema";

interface AchievementCardProps {
  points: number;
  badges: {
    id: number;
    name: string;
    icon: string;
    description: string;
    earned: boolean;
  }[];
}

export default function AchievementCard({ points, badges }: AchievementCardProps) {
  // Filter out duplicates based on badge ID
  const uniqueBadges = badges.reduce((acc, current) => {
    const x = acc.find(item => item.id === current.id);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as typeof badges);
  
  return (
    <Card className="rounded-2xl shadow-sm border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium">شارات الإنجاز</h2>
          <span className="material-icons text-accent">emoji_events</span>
        </div>
        
        {/* Avatar Section */}
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-neutral-200 overflow-hidden">
              {/* User image would go here */}
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-icons text-4xl text-neutral-500">person</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Achievement Badges */}
        <div className="grid grid-cols-4 gap-4">
          {uniqueBadges.map(badge => (
            <div key={badge.id} className="flex flex-col items-center">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  badge.earned 
                    ? "bg-accent/20" 
                    : "bg-neutral-200 opacity-50"
                }`}
              >
                <span 
                  className={`material-icons ${
                    badge.earned ? "text-accent" : "text-neutral-500"
                  }`}
                >
                  {badge.icon}
                </span>
              </div>
              <span className="text-xs text-center">{badge.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
