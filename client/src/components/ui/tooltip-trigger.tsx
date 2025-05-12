import React, { useRef, cloneElement, ReactElement } from "react";
import { useTooltips } from "@/hooks/use-tooltips";
import TooltipBox from "./tooltip-box";

interface TooltipTriggerProps {
  children: ReactElement;
  id: string;
  className?: string;
  showManually?: boolean;
}

export default function TooltipTrigger({
  children,
  id,
  className,
  showManually = false,
}: TooltipTriggerProps) {
  const {
    showTooltip,
    hideTooltip,
    activeTooltip,
    hasSeenTooltip,
    markTooltipAsSeen,
    currentTour,
    nextTourStep,
  } = useTooltips();
  const targetRef = useRef<HTMLElement>(null);

  // When the component mounts, check if it should show the tooltip
  React.useEffect(() => {
    // Skip if this tooltip has been seen already or if it should be shown manually
    if (hasSeenTooltip(id) || showManually) return;

    // Show the tooltip for this element
    const timer = setTimeout(() => {
      showTooltip(id);
    }, 500); // Small delay to ensure the component has rendered
    
    return () => clearTimeout(timer);
  }, [id, hasSeenTooltip, showTooltip, showManually]);

  // Handle clicking on the element
  const handleClick = () => {
    // If this is a manual tooltip, toggle it when clicked
    if (showManually && !activeTooltip) {
      showTooltip(id);
    }
  };

  return (
    <>
      {/* Clone the child element to add our ref and click handler */}
      {cloneElement(children, {
        ref: targetRef,
        className: className ? `${children.props.className} ${className}` : children.props.className,
        onClick: (e: React.MouseEvent) => {
          // Call the original onClick if it exists
          if (children.props.onClick) {
            children.props.onClick(e);
          }
          handleClick();
        },
      })}

      {/* Render the tooltip if this is the active tooltip */}
      {activeTooltip && activeTooltip.id === id && (
        <TooltipBox
          title={activeTooltip.data.title}
          content={activeTooltip.data.content}
          placement={activeTooltip.data.placement}
          onClose={() => currentTour.isActive ? nextTourStep() : markTooltipAsSeen(id)}
          onNextStep={nextTourStep}
          showNextButton={currentTour.isActive}
          targetRef={targetRef}
        />
      )}
    </>
  );
}