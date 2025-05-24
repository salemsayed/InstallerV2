import { Switch, Route } from "wouter";
import LoginPage from "@/pages/auth/login-page";
import LogoutPage from "@/pages/auth/logout-page";
import InstallerDashboard from "@/pages/installer/dashboard";
import InstallerStats from "@/pages/installer/stats";
import InstallerProfile from "@/pages/installer/profile";
import InstallerSettings from "@/pages/installer/settings";
import AdvancedScanPage from "@/pages/installer/advanced-scan";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import DebugPage from "@/pages/developer/debug-page";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { UserRole } from "@shared/schema";
import { DebugControls } from "@/components/debug/debug-controls";

// Protected route components with authentication requirements
const ProtectedInstallerDashboard = () => (
  <RequireAuth role={UserRole.INSTALLER}>
    <InstallerDashboard />
  </RequireAuth>
);

const ProtectedInstallerStats = () => (
  <RequireAuth role={UserRole.INSTALLER}>
    <InstallerStats />
  </RequireAuth>
);

const ProtectedInstallerProfile = () => (
  <RequireAuth role={UserRole.INSTALLER}>
    <InstallerProfile />
  </RequireAuth>
);

const ProtectedInstallerSettings = () => (
  <RequireAuth role={UserRole.INSTALLER}>
    <InstallerSettings />
  </RequireAuth>
);

const ProtectedAdvancedScan = () => (
  <RequireAuth role={UserRole.INSTALLER}>
    <AdvancedScanPage />
  </RequireAuth>
);

const ProtectedAdminDashboard = () => (
  <RequireAuth role={UserRole.ADMIN}>
    <AdminDashboard />
  </RequireAuth>
);

const ProtectedAdminUsers = () => (
  <RequireAuth role={UserRole.ADMIN}>
    <AdminUsers />
  </RequireAuth>
);

const ProtectedAdminSettings = () => (
  <RequireAuth role={UserRole.ADMIN}>
    <AdminSettings />
  </RequireAuth>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/auth/login" component={LoginPage} />
      <Route path="/auth/logout" component={LogoutPage} />
      
      {/* Installer Routes */}
      <Route path="/installer/home" component={ProtectedInstallerDashboard} />
      <Route path="/installer/dashboard" component={ProtectedInstallerDashboard} />
      <Route path="/installer/stats" component={ProtectedInstallerStats} />
      <Route path="/installer/profile" component={ProtectedInstallerProfile} />
      <Route path="/installer/settings" component={ProtectedInstallerSettings} />
      <Route path="/installer/advanced-scan" component={ProtectedAdvancedScan} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={ProtectedAdminDashboard} />
      <Route path="/admin/users" component={ProtectedAdminUsers} />
      <Route path="/admin/settings" component={ProtectedAdminSettings} />
      
      {/* Developer Routes */}
      <Route path="/developer/debug" component={DebugPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router />
      <DebugControls />
    </AuthProvider>
  );
}

export default App;
