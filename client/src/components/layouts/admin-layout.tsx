import { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import breegLogo from "@/assets/AR-Only.png";
import { useAuth } from "@/hooks/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminLayoutProps {
  children: ReactNode;
  className?: string;
  activeTab?: string;
  onTabChange?: (value: string) => void;
}

export default function AdminLayout({ 
  children, 
  className,
  activeTab = "overview",
  onTabChange
}: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const handleTabChange = (value: string) => {
    if (onTabChange) {
      onTabChange(value);
    }
  };

  return (
    <div className={cn("min-h-screen bg-neutral-50", className)}>
      {/* Admin Header */}
      <header className="bg-primary text-white shadow-sm" dir="rtl">
        <div className="px-4 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <img src={breegLogo} alt="بريق" className="h-6 ml-2" />
            <span className="font-bold">لوحة الإدارة</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-white">
                <span className="material-icons">more_vert</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={logout}>
                <span className="material-icons ml-2">logout</span>
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Admin Tab Navigation */}
        <div className="px-4 pb-2">
          <div className="w-full" dir="rtl">
            <div className="flex bg-transparent overflow-x-auto w-full">
              <Link href="/admin/dashboard">
                <a
                  onClick={() => handleTabChange("overview")}
                  className={cn(
                    "px-4 py-2 flex-shrink-0 text-white border-b-2 transition-colors",
                    activeTab === "overview" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  نظرة عامة
                </a>
              </Link>
              <Link href="/admin/users">
                <a
                  onClick={() => handleTabChange("users")}
                  className={cn(
                    "px-4 py-2 flex-shrink-0 text-white border-b-2 transition-colors",
                    activeTab === "users" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  المستخدمين
                </a>
              </Link>
              <Link href="/admin/dashboard">
                <a
                  onClick={() => handleTabChange("products")}
                  className={cn(
                    "px-4 py-2 flex-shrink-0 text-white border-b-2 transition-colors",
                    activeTab === "products" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  المنتجات
                </a>
              </Link>
              <Link href="/admin/dashboard">
                <a
                  onClick={() => handleTabChange("badges")}
                  className={cn(
                    "px-4 py-2 flex-shrink-0 text-white border-b-2 transition-colors",
                    activeTab === "badges" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  الشارات
                </a>
              </Link>
              <Link href="/admin/dashboard">
                <a
                  onClick={() => handleTabChange("stats")}
                  className={cn(
                    "px-4 py-2 flex-shrink-0 text-white border-b-2 transition-colors",
                    activeTab === "stats" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  الإحصائيات
                </a>
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      {/* Admin Content */}
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
