import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import arOnlyLogo from "@assets/AR-Only.png";
import { useAuth } from "@/hooks/auth-provider";
import QrScanner from "@/components/installer/qr-scanner";
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
}

export default function InstallerLayout({ children, className }: InstallerLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

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
              <DropdownMenuItem onClick={logout}>
                <span className="material-icons ml-2">logout</span>
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="pb-20">
        {children}
      </main>
      
      {/* QR Scanner - Only show when not on the scanner page */}
      {location !== "/scanner" && (
        <>
          <QrScanner onScanSuccess={(productName) => console.log(`Scanned product: ${productName}`)} />
          
          {/* Floating Action Button for Scanner Page */}
          <Link href="/scanner">
            <Button
              className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full shadow-xl bg-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/50 z-10 flex flex-col items-center justify-center border-4 border-white"
              aria-label="صفحة المسح الضوئي"
            >
              <span className="material-icons text-3xl">qr_code_scanner</span>
              <span className="text-[12px] mt-1 font-bold">مسح</span>
            </Button>
          </Link>
        </>
      )}
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex items-center justify-around py-3 px-6">
        <div className="w-1/3">
          <Link href="/installer/dashboard">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              location === "/installer/dashboard" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">home</span>
              <span className="text-xs mt-1">الرئيسية</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/3">
          <Link href="/installer/stats">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              location === "/installer/stats" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">insights</span>
              <span className="text-xs mt-1">الإحصائيات</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/3">
          <Link href="/installer/profile">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              location === "/installer/profile" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">person</span>
              <span className="text-xs mt-1">الملف الشخصي</span>
            </div>
          </Link>
        </div>
      </nav>
    </div>
  );
}
