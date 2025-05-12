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
import { TooltipProvider } from "@/hooks/use-tooltips";

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
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/settings" component={AdminSettings} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Router />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
