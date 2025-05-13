import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

/**
 * Component to notify users when a new version of the PWA is available
 * This will display when the service worker detects an update
 */
export const UpdateNotification = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    const handleUpdate = () => {
      setIsUpdateAvailable(true);
    };

    window.addEventListener('pwaUpdate', handleUpdate);
    return () => {
      window.removeEventListener('pwaUpdate', handleUpdate);
    };
  }, []);

  const handleUpdate = () => {
    // Send message to service worker to skip waiting
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Reload the page to activate the new service worker
    window.location.reload();
  };

  if (!isUpdateAvailable) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-white">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <p>تحديث جديد متاح للتطبيق</p>
        <Button
          onClick={handleUpdate}
          variant="secondary"
          size="sm"
          className="text-primary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>تحديث الآن</span>
        </Button>
      </div>
    </div>
  );
};