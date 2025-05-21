import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import arOnlyLogo from "@assets/AR-Only.png";
import { useAuth } from "@/hooks/auth-provider";
import { QrCode } from "lucide-react";
import { VersionDisplay } from "../version-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface InstallerLayoutProps {
  children: ReactNode;
  className?: string;
  activeTab?: string;
}

export default function InstallerLayout({ children, className, activeTab }: InstallerLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  
  // If activeTab is not provided, determine it from the location
  const currentTab = activeTab || (() => {
    if (location.includes('dashboard')) return 'dashboard';
    if (location.includes('stats')) return 'stats';
    if (location.includes('profile')) return 'profile';
    if (location.includes('settings')) return 'settings';
    if (location.includes('advanced-scan')) return 'advanced-scan';
    return 'dashboard';
  })();

  return (
    <div className={cn("min-h-screen bg-neutral-50", className)}>
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="px-4 py-5 flex justify-between items-center">
          <img src={arOnlyLogo} alt="بريق" className="h-10" />
          
          {/* Profile Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span className="material-icons">person</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <span className="material-icons ml-2">account_circle</span>
                <span>{user?.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <a 
                  href="/?force_logout=true" 
                  onClick={(e) => {
                    e.preventDefault();
                    // Clear all local storage first
                    localStorage.clear();
                    sessionStorage.clear();
                    // Then navigate directly to server logout endpoint
                    window.location.href = "/auth/logout?t=" + Date.now();
                  }}
                  className="flex items-center w-full"
                >
                  <span className="material-icons ml-2">logout</span>
                  <span>تسجيل الخروج</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="pb-20">
        {children}
      </main>
      
      {/* Main content area ends */}
      
      {/* Floating Scan Button */}
      <Link href="/installer/advanced-scan">
        <button
          className="fixed bottom-14 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full shadow-xl bg-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/50 z-10 flex flex-col items-center justify-center border-4 border-white text-white"
          aria-label="فتح الماسح المتقدم"
        >
          <QrCode className="h-8 w-8" />
          <span className="text-[12px] mt-1 font-bold">مسح</span>
        </button>
      </Link>
      
      {/* Version Info Bar - Positioned above the navigation with higher visibility */}
      <div className="fixed bottom-14 left-0 right-0 bg-primary/10 text-center py-1 shadow-inner z-10">
        <VersionDisplay className="text-xs font-medium" />
      </div>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex items-center justify-around py-3 px-6">
        <div className="w-1/4">
          <Link href="/installer/dashboard">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              currentTab === "dashboard" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">home</span>
              <span className="text-xs mt-1">الرئيسية</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/4">
          <Link href="/installer/stats">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              currentTab === "stats" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">insights</span>
              <span className="text-xs mt-1">الإحصائيات</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/4">
          <Link href="/installer/profile">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              currentTab === "profile" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">person</span>
              <span className="text-xs mt-1">الملف الشخصي</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/4">
          <Link href="/installer/settings">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              currentTab === "settings" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">settings</span>
              <span className="text-xs mt-1">الإعدادات</span>
            </div>
          </Link>
        </div>
      </nav>
    </div>
  );
}
