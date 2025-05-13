import { useEffect } from "react";
import { Switch, Route } from "wouter";
import LoginPage from "@/pages/auth/login-page";
import InstallerDashboard from "@/pages/installer/dashboard";
import InstallerStats from "@/pages/installer/stats";
import InstallerProfile from "@/pages/installer/profile";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/auth-provider";
import { setupPWA } from "@/pwa-utils";
import { OfflineIndicator, OfflineBanner } from "@/components/ui/offline-indicator";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { PWAUpdateNotification } from "@/components/ui/pwa-update-notification";

// Import scanner page
import InstallerScanner from "@/pages/installer/scanner";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/auth/login" component={LoginPage} />
      
      {/* Installer Routes */}
      <Route path="/installer/home" component={InstallerDashboard} />
      <Route path="/installer/dashboard" component={InstallerDashboard} />
      <Route path="/installer/stats" component={InstallerStats} />
      <Route path="/installer/profile" component={InstallerProfile} />
      <Route path="/scanner" component={InstallerScanner} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/settings" component={AdminSettings} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize the PWA
  useEffect(() => {
    const initPWA = async () => {
      try {
        await setupPWA();
        console.log('PWA setup complete');
      } catch (error) {
        console.error('Error setting up PWA:', error);
      }
    };

    initPWA();
  }, []);

  return (
    <AuthProvider>
      {/* PWA Components */}
      <OfflineBanner />
      <OfflineIndicator />
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      
      {/* Main App Content */}
      <Router />
    </AuthProvider>
  );
}

export default App;
