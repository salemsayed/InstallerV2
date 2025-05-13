import { useEffect } from 'react';
import InstallerLayout from '@/components/layouts/installer-layout';
import QrScanner from '@/components/installer/qr-scanner';
import { useAuth } from '@/hooks/auth-provider';
import { useLocation } from 'wouter';
import { isOffline } from '@/pwa-utils';

export default function ScannerPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      navigate('/auth/login');
      return;
    }
    
    // Redirect if not an installer
    if (user.role !== 'installer') {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/');
      return;
    }
    
    // Request camera permissions - important for PWA
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then((result) => {
          console.log('Camera permission status:', result.state);
          
          // If denied, show a message
          if (result.state === 'denied') {
            alert('يرجى السماح بالوصول إلى الكاميرا لاستخدام ماسح QR');
          }
        })
        .catch(error => {
          console.error('Error checking camera permission:', error);
        });
    }
    
    // Set up media devices in PWA for iOS
    navigator.mediaDevices?.getUserMedia?.({ video: true })
      .then((stream) => {
        // Just request access then stop it immediately
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(error => {
        console.error('Error requesting camera access:', error);
      });
    
    // Show offline warning if offline
    if (isOffline()) {
      const offlineWarning = document.createElement('div');
      offlineWarning.classList.add('fixed', 'top-0', 'left-0', 'right-0', 'bg-yellow-500', 'text-white', 'p-2', 'text-center', 'z-50');
      offlineWarning.innerText = 'أنت في وضع عدم الاتصال. سيتم حفظ عمليات المسح ومزامنتها لاحقًا.';
      document.body.appendChild(offlineWarning);
      
      return () => {
        document.body.removeChild(offlineWarning);
      };
    }
  }, [user, navigate]);
  
  // Show loading until authentication is checked
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
      <div className="pt-0 min-h-[80vh] flex justify-center items-center">
        <QrScanner 
          fullScreen={true} 
          onScanSuccess={(productName) => {
            console.log(`Scanned product in dedicated scanner: ${productName}`);
          }} 
        />
      </div>
    </InstallerLayout>
  );
}