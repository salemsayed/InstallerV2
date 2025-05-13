import { useEffect, useState } from 'react';
import InstallerLayout from '@/components/layouts/installer-layout';
import QrScanner from '@/components/installer/qr-scanner';
import { useAuth } from '@/hooks/auth-provider';
import { useLocation } from 'wouter';
import { isOffline } from '@/pwa-utils';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScannerPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [scannerStarted, setScannerStarted] = useState(false);
  
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
    }
    
    // Camera permissions and setup
    const setupCamera = async () => {
      try {
        // Check camera permission
        if ('permissions' in navigator) {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('Camera permission status:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            alert('يرجى السماح بالوصول إلى الكاميرا لاستخدام ماسح QR');
            return;
          }
        }
        
        // Pre-warm camera for better responsiveness
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Success - scanner can start
        setScannerStarted(true);
        
        // Set up cleanup function for stream
        return () => {
          stream.getTracks().forEach(track => track.stop());
        };
      } catch (error) {
        console.error('Error setting up camera:', error);
        alert('حدث خطأ في الوصول إلى الكاميرا. يرجى التحقق من الإذن ومحاولة مرة أخرى.');
      }
    };
    
    // Setup camera
    const cleanupCamera = setupCamera();
    
    // Cleanup function
    return () => {
      if (offlineWarning) {
        document.body.removeChild(offlineWarning);
      }
      
      // Clean up camera if needed
      if (cleanupCamera) {
        cleanupCamera.then(cleanup => {
          if (cleanup) cleanup();
        });
      }
    };
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
      <div className="pt-0 min-h-[80vh] flex justify-center items-center">
        {scannerStarted ? (
          <QrScanner 
            fullScreen={true} 
            onScanSuccess={(productName) => {
              console.log(`Scanned product in dedicated scanner: ${productName}`);
            }} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-gray-600">جارٍ تهيئة الكاميرا...</p>
          </div>
        )}
      </div>
    </InstallerLayout>
  );
}