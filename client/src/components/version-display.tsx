import React from 'react';
import { APP_VERSION } from '@shared/version';

interface VersionDisplayProps {
  className?: string;
}

export function VersionDisplay({ className = '' }: VersionDisplayProps) {
  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      {APP_VERSION}
    </div>
  );
}