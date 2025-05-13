import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { addOfflineListener } from '@/pwa-utils';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Add listener for online/offline events
    const removeListener = addOfflineListener((offline) => {
      setIsOffline(offline);
      if (offline) {
        setShow(true);
        const timer = setTimeout(() => {
          setShow(false);
        }, 5000);
        return () => clearTimeout(timer);
      } else {
        setShow(true);
        const timer = setTimeout(() => {
          setShow(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    // Cleanup
    return () => {
      removeListener();
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-20 left-0 right-0 mx-auto w-max z-50 p-2 px-4 rounded-full shadow-lg transition-all duration-300 ${
        isOffline
          ? 'bg-destructive/90 text-destructive-foreground'
          : 'bg-green-500/90 text-white'
      } ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {isOffline ? (
          <>
            <WifiOff size={16} />
            <span>أنت غير متصل بالإنترنت</span>
          </>
        ) : (
          <>
            <Wifi size={16} />
            <span>تم استعادة الاتصال بالإنترنت</span>
          </>
        )}
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Add listener for online/offline events
    const removeListener = addOfflineListener(setIsOffline);

    // Cleanup
    return () => {
      removeListener();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-destructive/90 text-destructive-foreground py-1 px-4 text-xs font-medium flex items-center justify-center gap-1 sticky top-0 z-50">
      <WifiOff size={12} />
      <span>وضع عدم الاتصال - بعض الميزات قد لا تعمل</span>
    </div>
  );
}