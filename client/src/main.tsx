import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { registerServiceWorker } from "./pwa-utils";

// PWA registration
if (import.meta.env.PROD) {
  // Register service worker in production only
  registerServiceWorker()
    .then(success => {
      console.log(success ? 'PWA setup complete' : 'PWA setup failed');
    })
    .catch(error => {
      console.error('Error setting up PWA:', error);
    });
}

// Components for displaying PWA status
const PWAContainer = ({ children }: { children: React.ReactNode }) => {
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

  return (
    <>
      {children}
      {isUpdateAvailable && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-primary text-white text-center">
          <p>تحديث جديد متاح للتطبيق</p>
          <button 
            className="mt-2 px-4 py-2 bg-white text-primary rounded-md"
            onClick={() => window.location.reload()}
          >
            تحديث الآن
          </button>
        </div>
      )}
    </>
  );
};

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <PWAContainer>
        <App />
      </PWAContainer>
    </TooltipProvider>
  </QueryClientProvider>
);
