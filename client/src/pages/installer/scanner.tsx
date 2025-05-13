import { useEffect } from 'react';
import InstallerLayout from '@/components/layouts/installer-layout';
import StandaloneScanner from '@/components/installer/standalone-scanner';
import { useAuth } from '@/hooks/auth-provider';
import { useLocation } from 'wouter';
import { isOffline } from '@/pwa-utils';

export default function ScannerPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Basic auth checks
    if (!user) {
      navigate('/auth/login');
      return;
    }
    
    if (user.role !== 'installer') {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/');
      return;
    }
    
    // Show offline warning if offline
    let offlineWarning: HTMLElement | null = null;
    if (isOffline()) {
      offlineWarning = document.createElement('div');
      offlineWarning.classList.add('fixed', 'top-0', 'left-0', 'right-0', 'bg-yellow-500', 'text-white', 'p-2', 'text-center', 'z-50');
      offlineWarning.innerText = 'أنت في وضع عدم الاتصال. سيتم حفظ عمليات المسح ومزامنتها لاحقًا.';
      document.body.appendChild(offlineWarning);
      
      return () => {
        if (offlineWarning) {
          document.body.removeChild(offlineWarning);
        }
      };
    }
  }, [user, navigate]);
  
  // Loading state
  if (!user) {
    return (
      <InstallerLayout>
        <div className="flex justify-center items-center h-[80vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </InstallerLayout>
    );
  }
  
  return (
    <InstallerLayout>
      <div className="pt-4 px-4 min-h-[80vh] flex justify-center items-center">
        <StandaloneScanner />
      </div>
    </InstallerLayout>
  );
}