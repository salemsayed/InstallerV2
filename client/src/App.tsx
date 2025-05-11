import { Switch, Route } from "wouter";
import Login from "@/pages/auth/login";
import MagicLink from "@/pages/auth/magic-link";
import InstallerDashboard from "@/pages/installer/dashboard";
import InstallerStats from "@/pages/installer/stats";
import InstallerProfile from "@/pages/installer/profile";
import AdminDashboard from "@/pages/admin/dashboard";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/auth-provider";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/auth/magic-link" component={MagicLink} />
      
      {/* Installer Routes */}
      <Route path="/installer/dashboard" component={InstallerDashboard} />
      <Route path="/installer/stats" component={InstallerStats} />
      <Route path="/installer/profile" component={InstallerProfile} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

export default App;
