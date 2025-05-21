import React from 'react';
import { APP_VERSION } from '@shared/version';
import { cn } from '@/lib/utils';

interface VersionDisplayProps {
  className?: string;
  variant?: 'compact' | 'full' | 'responsive';
}

export function VersionDisplay({ 
  className = '', 
  variant = 'responsive' 
}: VersionDisplayProps) {
  
  // Define responsive classes based on variant
  const baseClasses = "transition-all duration-200";
  
  // Different styling based on variant
  const variantClasses = {
    compact: "text-xs",
    full: "text-sm",
    responsive: "text-xs sm:text-sm md:inline-flex md:items-center"
  };
  
  // For responsive variant, we show different text based on screen size
  if (variant === 'responsive') {
    return (
      <div className={cn(baseClasses, variantClasses[variant], className)}>
        <span className="md:hidden">{APP_VERSION}</span>
        <span className="hidden md:inline">
          <span className="font-medium mr-1">Version:</span>
          {APP_VERSION}
        </span>
      </div>
    );
  }
  
  // For compact and full variants
  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      {variant === 'full' ? (
        <span><span className="font-medium mr-1">Version:</span>{APP_VERSION}</span>
      ) : (
        APP_VERSION
      )}
    </div>
  );
}