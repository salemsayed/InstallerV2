import { Switch, Route } from "wouter";
import Login from "@/pages/auth/login";
import MagicLink from "@/pages/auth/magic-link";
import InstallerDashboard from "@/pages/installer/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/auth-provider";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/auth/magic-link" component={MagicLink} />
      <Route path="/installer/dashboard" component={InstallerDashboard} />
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
