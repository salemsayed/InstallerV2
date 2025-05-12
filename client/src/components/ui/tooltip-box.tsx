import React from "react";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TooltipBoxProps {
  title: string;
  content: string;
  placement: "top" | "right" | "bottom" | "left";
  onClose: () => void;
  onNextStep?: () => void;
  showNextButton?: boolean;
  targetRef?: React.RefObject<HTMLElement>;
  className?: string;
}

export default function TooltipBox({
  title,
  content,
  placement = "bottom",
  onClose,
  onNextStep,
  showNextButton = false,
  targetRef,
  className,
}: TooltipBoxProps) {
  const [position, setPosition] = React.useState({
    top: 0,
    left: 0,
  });

  React.useEffect(() => {
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (placement) {
        case "top":
          top = rect.top - 10 - 120; // 120px is approx height of tooltip
          left = rect.left + rect.width / 2 - 150; // 150px is half the width of tooltip
          break;
        case "right":
          top = rect.top + rect.height / 2 - 60;
          left = rect.right + 10;
          break;
        case "bottom":
          top = rect.bottom + 10;
          left = rect.left + rect.width / 2 - 150;
          break;
        case "left":
          top = rect.top + rect.height / 2 - 60;
          left = rect.left - 10 - 300; // 300px is the width of tooltip
          break;
      }

      // Adjust for screen boundaries
      if (left < 20) left = 20;
      if (left + 300 > window.innerWidth) left = window.innerWidth - 320;
      if (top < 20) top = 20;
      if (top + 120 > window.innerHeight) top = window.innerHeight - 140;

      setPosition({ top, left });
    }
  }, [targetRef, placement]);

  // If no targetRef is provided, position the tooltip in the center of the screen
  React.useEffect(() => {
    if (!targetRef) {
      setPosition({
        top: window.innerHeight / 2 - 60,
        left: window.innerWidth / 2 - 150,
      });
    }
  }, [targetRef]);

  return (
    <div
      className={cn(
        "fixed z-50 bg-white shadow-lg rounded-lg p-4 w-[300px] border border-border",
        "text-right",
        className
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{content}</p>
      
      <div className="flex justify-between items-center">
        {showNextButton && onNextStep ? (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              if (onNextStep) onNextStep();
            }}
            className="bg-primary text-white px-4 py-2 rounded-md text-sm flex items-center justify-center gap-1 hover:bg-primary/90 transition-colors"
          >
            <span>التالي</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div></div>  
        )}
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm"
        >
          فهمت
        </button>
      </div>

      {/* Triangle indicator based on placement */}
      {targetRef && (
        <div
          className={cn(
            "absolute w-4 h-4 bg-white border-t border-r border-border rotate-45",
            {
              "top-[-8px] left-1/2 -translate-x-1/2 border-l border-r-0 border-b-0":
                placement === "bottom",
              "bottom-[-8px] left-1/2 -translate-x-1/2 border-b border-l border-t-0 border-r-0":
                placement === "top",
              "right-[-8px] top-1/2 -translate-y-1/2 border-t border-r border-l-0 border-b-0":
                placement === "left",
              "left-[-8px] top-1/2 -translate-y-1/2 border-b border-l border-t-0 border-r-0":
                placement === "right",
            }
          )}
        />
      )}
    </div>
  );
}