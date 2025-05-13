import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isPWAInstalled } from '@/pwa-utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [userSeen, setUserSeen] = useState(false);

  useEffect(() => {
    // Check if already installed or user has dismissed
    if (isPWAInstalled() || localStorage.getItem('pwa-prompt-dismissed') === 'true') {
      return;
    }

    // If user has already seen the prompt in this session, don't show again
    if (userSeen) return;

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      
      // Don't show immediately, wait for a good moment
      // For example, after the user has been on the site for a while
      setTimeout(() => {
        setShowPrompt(true);
        setUserSeen(true);
      }, 60000); // 1 minute
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [userSeen]);

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      } else {
        console.log('User dismissed the PWA install prompt');
        localStorage.setItem('pwa-prompt-dismissed', 'true');
      }
      
      setInstallPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 z-50 animate-in slide-in-from-bottom duration-300">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <X size={18} />
      </button>
      
      <div className="flex items-center space-x-4 space-x-reverse">
        <div className="flex-shrink-0">
          <img src="/icons/icon-192x192.png" alt="BAREEQ" className="w-12 h-12 rounded-xl" />
        </div>
        
        <div className="flex-1 ml-4 text-right">
          <h3 className="font-bold text-base">إضافة برنامج بريق إلى الشاشة الرئيسية</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            قم بتثبيت التطبيق للوصول السريع واستخدامه بدون اتصال بالإنترنت
          </p>
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={handleDismiss} className="ml-2">
          ليس الآن
        </Button>
        <Button onClick={handleInstall} className="flex items-center gap-1">
          <Download size={16} />
          <span>تثبيت التطبيق</span>
        </Button>
      </div>
    </div>
  );
}