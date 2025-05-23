import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return "";
    }
    
    // Format date in Arabic style with Gregorian calendar (day-month-year)
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
}

export function formatNumber(num: number): string {
  if (num === undefined || num === null) return "";
  
  // Format number with Arabic numerals and thousands separator
  return num.toLocaleString("ar-SA");
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + "...";
}

export function getActivityIcon(type: string): string {
  switch (type) {
    case "installation":
      return "build";
    case "maintenance":
      return "handyman";
    case "training":
      return "school";
    default:
      return "work";
  }
}

export function calculateLevelProgress(points: number): { level: number; progress: number; nextLevelPoints: number } {
  // This is a simple level calculation algorithm
  // Level 1: 0-999 points
  // Level 2: 1000-2499 points
  // Level 3: 2500-4999 points
  // Level 4: 5000-9999 points
  // Level 5: 10000+ points
  
  const levels = [
    { level: 1, threshold: 0 },
    { level: 2, threshold: 1000 },
    { level: 3, threshold: 2500 },
    { level: 4, threshold: 5000 },
    { level: 5, threshold: 10000 }
  ];
  
  // Find current level
  let currentLevel = levels[0];
  let nextLevel = levels[1];
  
  for (let i = 1; i < levels.length; i++) {
    if (points >= levels[i].threshold) {
      currentLevel = levels[i];
      nextLevel = levels[i + 1] || levels[i];
    } else {
      nextLevel = levels[i];
      break;
    }
  }
  
  // Calculate progress to next level
  const currentThreshold = currentLevel.threshold;
  const nextThreshold = nextLevel.threshold;
  const progress = nextThreshold > currentThreshold 
    ? (points - currentThreshold) / (nextThreshold - currentThreshold) 
    : 1;
  
  return {
    level: currentLevel.level,
    progress: Math.min(progress, 1),
    nextLevelPoints: nextThreshold
  };
}

export function isEmailValid(email: string): boolean {
  // Basic email validation
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Function to check if a user qualifies for a badge
export function checkBadgeQualification(
  userStats: { 
    points: number; 
    installationCount?: number; 
  },
  badge: {
    id: number;
    requiredPoints?: number | null;
    minInstallations?: number | null;
  }
): boolean {
  // Check points requirement
  if (badge.requiredPoints && userStats.points < badge.requiredPoints) {
    return false;
  }
  
  // Check installations requirement
  if (badge.minInstallations && 
      (userStats.installationCount === undefined || 
       userStats.installationCount < badge.minInstallations)) {
    return false;
  }
  
  // If all requirements are met or there are no requirements
  return true;
}
