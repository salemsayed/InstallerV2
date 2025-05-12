import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useAuth } from "@/hooks/auth-provider";

// Define the tooltips data type
interface TooltipDictionary {
  [key: string]: {
    title: string;
    content: string;
    placement: "top" | "right" | "bottom" | "left";
  }
}

// Define the tooltips for each user role
const ADMIN_TOOLTIPS: TooltipDictionary = {
  "dashboard-overview": {
    title: "لوحة المعلومات",
    content: "هنا يمكنك مشاهدة إحصائيات النظام، مثل عدد الفنيين وعدد التركيبات التي تمت",
    placement: "bottom"
  },
  "users-management": {
    title: "إدارة المستخدمين",
    content: "إدارة الفنيين وحساباتهم ومراقبة نشاطهم",
    placement: "bottom"
  },
  "users-table": {
    title: "جدول المستخدمين",
    content: "جدول عرض جميع الفنيين المسجلين في النظام، يمكنك تعديل بيانات أي فني من هنا",
    placement: "bottom"
  },
  "points-allocation": {
    title: "تخصيص النقاط",
    content: "يمكنك إضافة نقاط للفنيين من هنا عند إكمال المهام المختلفة",
    placement: "left"
  },
  "badges-management": {
    title: "إدارة الشارات",
    content: "إنشاء وتعديل الشارات التي يمكن للفنيين الحصول عليها",
    placement: "bottom"
  },
  "products-management": {
    title: "إدارة المنتجات",
    content: "إدارة قائمة المنتجات ونقاط كل منتج، والتي يتم منحها للفنيين عند مسح الرمز الخاص بها",
    placement: "bottom"
  }
};

const INSTALLER_TOOLTIPS: TooltipDictionary = {
  "dashboard-points": {
    title: "نقاطك",
    content: "هنا يمكنك مشاهدة نقاطك الحالية والتي حصلت عليها من عمليات التركيب",
    placement: "bottom"
  },
  "dashboard-installations": {
    title: "التركيبات",
    content: "عدد عمليات التركيب التي أكملتها",
    placement: "bottom"
  },
  "scanner-button": {
    title: "مسح رمز QR",
    content: "اضغط هنا لمسح رمز QR الخاص بالمنتج الذي قمت بتركيبه للحصول على نقاط",
    placement: "top"
  },
  "badges-section": {
    title: "الشارات",
    content: "هنا يمكنك مشاهدة الشارات التي حصلت عليها، واكتشاف الشارات المتبقية",
    placement: "left"
  }
};

// Tooltip interface
interface TooltipData {
  title: string;
  content: string;
  placement: "top" | "right" | "bottom" | "left";
}

// Context interface
interface TooltipContextType {
  // Show a specific tooltip
  showTooltip: (id: string) => void;
  // Hide the currently shown tooltip
  hideTooltip: () => void;
  // Get the currently active tooltip data
  activeTooltip: { id: string; data: TooltipData } | null;
  // Check if a specific tooltip has been seen
  hasSeenTooltip: (id: string) => boolean;
  // Mark tooltip as seen permanently
  markTooltipAsSeen: (id: string) => void;
  // Start a guided tour - show tooltips in sequence
  startTour: (tourIds: string[]) => void;
  // Go to next tooltip in a tour
  nextTourStep: () => void;
  // Current tour state
  currentTour: {
    tourIds: string[];
    currentIndex: number;
    isActive: boolean;
  };
}

// Create context
const TooltipContext = createContext<TooltipContextType | null>(null);

// Provider component
export function TooltipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Use refs to preserve tooltip state during rerenders caused by user data refreshes
  const activeTooltipRef = useRef<{ id: string; data: TooltipData } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ id: string; data: TooltipData } | null>(null);
  
  // When setting active tooltip, also update the ref
  const updateActiveTooltip = (tooltip: { id: string; data: TooltipData } | null) => {
    activeTooltipRef.current = tooltip;
    setActiveTooltip(tooltip);
  };
  
  // Store seen tooltips in localStorage to persist across refreshes
  const [seenTooltips, setSeenTooltips] = useState<string[]>(() => {
    const saved = localStorage.getItem('seenTooltips');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Store tour state in ref to persist during refreshes
  const tourStateRef = useRef<{
    tourIds: string[];
    currentIndex: number;
    isActive: boolean;
  }>({
    tourIds: [],
    currentIndex: 0,
    isActive: false
  });
  
  const [currentTour, setCurrentTour] = useState<{
    tourIds: string[];
    currentIndex: number;
    isActive: boolean;
  }>({
    tourIds: [],
    currentIndex: 0,
    isActive: false
  });
  
  // When setting tour state, also update the ref
  const updateTourState = (tourState: typeof currentTour) => {
    tourStateRef.current = tourState;
    setCurrentTour(tourState);
  };

  // Initialize seen tooltips from localStorage
  useEffect(() => {
    if (user?.id) {
      const storedTooltips = localStorage.getItem(`seen-tooltips-${user.id}`);
      if (storedTooltips) {
        setSeenTooltips(JSON.parse(storedTooltips));
      }
    }
  }, [user?.id]);

  // Save seen tooltips to localStorage when updated
  useEffect(() => {
    if (user?.id && seenTooltips.length > 0) {
      localStorage.setItem(`seen-tooltips-${user.id}`, JSON.stringify(seenTooltips));
    }
  }, [seenTooltips, user?.id]);

  // Get all tooltips based on user role
  const getAllTooltips = (): TooltipDictionary => {
    if (!user) return {} as TooltipDictionary;
    return user.role === "admin" ? ADMIN_TOOLTIPS : INSTALLER_TOOLTIPS;
  };

  // Show a specific tooltip
  const showTooltip = (id: string) => {
    const tooltips = getAllTooltips();
    if (tooltips[id]) {
      updateActiveTooltip({ id, data: tooltips[id] });
    }
  };

  // Hide the currently shown tooltip
  const hideTooltip = () => {
    const currentActive = activeTooltip;
    updateActiveTooltip(null);
    
    // If this is not part of a tour step (manual closing), clean up the tour state
    if (currentActive && !currentTour.isActive) {
      localStorage.removeItem('tooltip_tour_active');
    }
  };

  // Check if a tooltip has been seen
  const hasSeenTooltip = (id: string) => {
    return seenTooltips.includes(id);
  };

  // Mark a tooltip as seen
  const markTooltipAsSeen = (id: string) => {
    if (!hasSeenTooltip(id)) {
      setSeenTooltips([...seenTooltips, id]);
    }
    hideTooltip();
  };

  // Start a guided tour
  const startTour = (tourIds: string[]) => {
    if (tourIds.length > 0) {
      try {
        // Clear any existing tooltips first
        hideTooltip();
        
        // Set the localStorage flag to indicate tour is active and pause data refresh
        localStorage.setItem('tooltip_tour_active', 'true');
        
        // Update tour state
        setCurrentTour({
          tourIds,
          currentIndex: 0,
          isActive: true
        });
        
        // Add a small delay before showing the first tooltip
        setTimeout(() => {
          if (localStorage.getItem('tooltip_tour_active') === 'true') {
            showTooltip(tourIds[0]);
          }
        }, 100);
      } catch (error) {
        console.error("Error in startTour:", error);
        localStorage.removeItem('tooltip_tour_active');
      }
    }
  };

  // Go to next tooltip in tour
  const nextTourStep = () => {
    if (currentTour.isActive && activeTooltip) {
      try {
        // First hide the current tooltip to avoid overlapping tooltips during transition
        hideTooltip();
  
        // Mark the current tooltip as seen and save to localStorage immediately
        if (!hasSeenTooltip(activeTooltip.id)) {
          const newSeenTooltips = [...seenTooltips, activeTooltip.id];
          setSeenTooltips(newSeenTooltips);
          
          if (user?.id) {
            localStorage.setItem(`seen-tooltips-${user.id}`, JSON.stringify(newSeenTooltips));
          }
        }
        
        const nextIndex = currentTour.currentIndex + 1;
        
        // If we have more steps in the tour
        if (nextIndex < currentTour.tourIds.length) {
          // Make sure refresh is paused while tour is active
          localStorage.setItem('tooltip_tour_active', 'true');
          
          // Update tour state
          setCurrentTour({
            ...currentTour,
            currentIndex: nextIndex
          });
          
          // Add a longer delay to ensure proper transition
          setTimeout(() => {
            // Double-check the tour is still active before showing next tooltip
            if (localStorage.getItem('tooltip_tour_active') === 'true') {
              showTooltip(currentTour.tourIds[nextIndex]);
            }
          }, 100);
        } else {
          // End of tour
          setCurrentTour({
            tourIds: [],
            currentIndex: 0,
            isActive: false
          });
          
          // Tour is over, resume data refreshing
          localStorage.removeItem('tooltip_tour_active');
        }
      } catch (error) {
        console.error("Error in nextTourStep:", error);
        // If anything goes wrong, make sure to clean up
        localStorage.removeItem('tooltip_tour_active');
      }
    }
  };

  return (
    <TooltipContext.Provider value={{
      showTooltip,
      hideTooltip,
      activeTooltip,
      hasSeenTooltip,
      markTooltipAsSeen,
      startTour,
      nextTourStep,
      currentTour
    }}>
      {children}
    </TooltipContext.Provider>
  );
}

// Custom hook for using tooltips
export function useTooltips() {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error("useTooltips must be used within a TooltipProvider");
  }
  return context;
}