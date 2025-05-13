import { useEffect, lazy, Suspense } from "react";
import { Switch, Route } from "wouter";

// Page imports
import LoginPage from "@/pages/auth/login-page";
import InstallerDashboard from "@/pages/installer/dashboard";
import InstallerStats from "@/pages/installer/stats";
import InstallerProfile from "@/pages/installer/profile";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import NotFound from "@/pages/not-found";

// Lazy load the scanner page to improve initial load time
const ScannerPage = lazy(() => import("./pages/installer/scanner"));

// Providers and utilities
import { AuthProvider } from "@/hooks/auth-provider";
import { setupPWA } from "@/pwa-utils";

// PWA components
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { InstallPrompt } from "@/components/ui/install-prompt";
import { UpdateNotification } from "@/components/ui/update-notification";

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
      <Route path="/scanner">
        <Suspense fallback={
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <ScannerPage />
        </Suspense>
      </Route>
      
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
      <OfflineIndicator />
      <InstallPrompt />
      <UpdateNotification />
      
      {/* Main App Content */}
      <Router />
    </AuthProvider>
  );
}

export default App;
