import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import breegLogo from "@/assets/breeg-logo.svg";
import { useAuth } from "@/hooks/use-auth";
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
          <img src={breegLogo} alt="بريق" className="h-8" />
          
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
