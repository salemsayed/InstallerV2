import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import arOnlyLogo from "@assets/AR-Only.png";
import { useAuth } from "@/hooks/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import QrScanner from "@/components/installer/qr-scanner";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InstallerLayoutProps {
  children: ReactNode;
  className?: string;
}

export default function InstallerLayout({ children, className }: InstallerLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();

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
      <main className="pb-24">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex items-center justify-between py-4 px-8">
        <Link href="/installer/dashboard">
          <div className={cn(
            "flex flex-col items-center cursor-pointer px-4 pt-2",
            location === "/installer/dashboard" ? "text-primary font-medium" : "text-neutral-500"
          )}>
            <span className="material-icons text-2xl">home</span>
            <span className="text-xs mt-1">الرئيسية</span>
          </div>
        </Link>
        
        {/* Center space for QR Scanner button */}
        <div className="w-28 h-16 flex-shrink-0 invisible">
          {/* This invisible space creates room for the floating button */}
        </div>
        
        <Link href="/installer/profile">
          <div className={cn(
            "flex flex-col items-center cursor-pointer px-4 pt-2",
            location === "/installer/profile" ? "text-primary font-medium" : "text-neutral-500"
          )}>
            <span className="material-icons text-2xl">person</span>
            <span className="text-xs mt-1">الملف الشخصي</span>
          </div>
        </Link>
      </nav>
      
      {/* QR Scanner - available on all installer pages */}
      <QrScanner 
        onScanSuccess={(productName) => {
          // Refresh queries to update data
          queryClient.invalidateQueries({
            queryKey: [`/api/transactions?userId=${user?.id}`]
          });
          
          // Also refresh user data to update points
          queryClient.invalidateQueries({
            queryKey: ["/api/users/me"]
          });
          
          toast({
            title: "تم التسجيل بنجاح",
            description: `تم إضافة 10 نقاط إلى رصيدك لتركيب ${productName || "منتج جديد"}`,
            variant: "default",
          });
        }} 
      />
    </div>
  );
}
