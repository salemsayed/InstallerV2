import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAUpdateNotification() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    // Listen for update messages from the service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        setShowUpdatePrompt(true);
      }
    };
    
    // Listen for our custom event from pwa-utils.ts
    const handleCustomEvent = () => {
      setShowUpdatePrompt(true);
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    window.addEventListener('pwaUpdate', handleCustomEvent);

    // Cleanup
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      window.removeEventListener('pwaUpdate', handleCustomEvent);
    };
  }, []);

  const handleUpdate = () => {
    // Send message to service worker to skip waiting
    navigator.serviceWorker?.ready.then((registration) => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    
    // Reload the page to activate the new service worker
    window.location.reload();
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed top-4 right-4 left-4 z-50 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg text-right">
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={() => setShowUpdatePrompt(false)}
        >
          <span className="sr-only">إغلاق</span>
          <AlertCircle className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 mx-2">
          <h3 className="font-medium text-blue-800">تحديث جديد متاح</h3>
          <p className="text-sm text-blue-600">
            هناك نسخة جديدة من التطبيق متاحة. قم بالتحديث للحصول على أحدث الميزات.
          </p>
        </div>
      </div>
      
      <div className="mt-3 flex justify-start">
        <Button 
          variant="default" 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
          onClick={handleUpdate}
        >
          <RefreshCw className="h-4 w-4" />
          <span>تحديث الآن</span>
        </Button>
      </div>
    </div>
  );
}