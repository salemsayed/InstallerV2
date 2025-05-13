import { useEffect, useState } from "react";
import { isOffline, addOfflineListener } from "@/pwa-utils";
import { WifiOff } from "lucide-react";

export const OfflineIndicator = () => {
  const [offline, setOffline] = useState(isOffline());

  useEffect(() => {
    // Setup offline status listener
    const removeListener = addOfflineListener((isOfflineStatus) => {
      setOffline(isOfflineStatus);
    });

    // Cleanup listener on unmount
    return () => removeListener();
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white shadow-md">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <WifiOff className="h-4 w-4" />
        <span>أنت غير متصل بالإنترنت. بعض المميزات قد لا تعمل.</span>
      </div>
    </div>
  );
};