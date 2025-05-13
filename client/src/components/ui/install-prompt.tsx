import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { isPWAInstalled } from "@/pwa-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Install prompt for PWA
 * This component shows a prompt to install the PWA on the user's device
 * It handles the installation process and tracks whether the user has dismissed the prompt
 */
export const InstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isPWAInstalled());

  // Check if the user has already installed the PWA
  useEffect(() => {
    if (isPWAInstalled()) {
      setIsInstalled(true);
    }

    // Event listener to see if the PWA is installed
    const handleDisplayModeChange = () => {
      setIsInstalled(isPWAInstalled());
    };

    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);
    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPromptEvent(e);
      
      // Check if the user has previously dismissed the prompt
      const hasUserDismissed = localStorage.getItem('installPromptDismissed');
      
      // Only show the install prompt if the user hasn't dismissed it in the last 7 days
      if (!hasUserDismissed || (Date.now() - parseInt(hasUserDismissed)) > 7 * 24 * 60 * 60 * 1000) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle the installation process
  const handleInstallClick = () => {
    if (!installPromptEvent) return;

    // Show the install prompt
    installPromptEvent.prompt();

    // Wait for the user to respond to the prompt
    installPromptEvent.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setIsInstalled(true);
      } else {
        console.log('User dismissed the install prompt');
      }
      // Clear the saved prompt as it can't be used again
      setInstallPromptEvent(null);
      setIsVisible(false);
    });
  };

  // Dismiss the install prompt
  const handleDismiss = () => {
    localStorage.setItem('installPromptDismissed', Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40">
      <Card className="border border-primary/20 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">تطبيق بريق</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">إغلاق</span>
            </Button>
          </div>
          <CardDescription>
            أضف التطبيق إلى شاشة الهاتف للوصول السريع
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full gap-2 bg-gradient-to-r from-primary to-primary/90"
            onClick={handleInstallClick}
          >
            <Download className="h-4 w-4" />
            <span>تثبيت التطبيق</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};