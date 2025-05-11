import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
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
      <header className="bg-primary text-white shadow-sm">
        <div className="px-4 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <img src={breegLogo} alt="بريق" className="h-6 ml-2" />
            <span className="font-bold mr-1">لوحة الإدارة</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-white">
                <span className="material-icons">more_vert</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>
                <span className="material-icons ml-2">logout</span>
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Admin Tab Navigation */}
        <div className="px-4 pb-2">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="bg-transparent hide-scrollbar overflow-x-auto w-full justify-start">
              <TabsTrigger 
                value="overview" 
                className={cn(
                  "text-white data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  activeTab !== "overview" && "text-white/70"
                )}
              >
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className={cn(
                  "text-white data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  activeTab !== "users" && "text-white/70"
                )}
              >
                المستخدمين
              </TabsTrigger>
              <TabsTrigger 
                value="products" 
                className={cn(
                  "text-white data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  activeTab !== "products" && "text-white/70"
                )}
              >
                المنتجات
              </TabsTrigger>
              <TabsTrigger 
                value="badges" 
                className={cn(
                  "text-white data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  activeTab !== "badges" && "text-white/70"
                )}
              >
                الشارات
              </TabsTrigger>
              <TabsTrigger 
                value="stats" 
                className={cn(
                  "text-white data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  activeTab !== "stats" && "text-white/70"
                )}
              >
                الإحصائيات
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      
      {/* Admin Content */}
      <main className="p-4 pb-20">
        {children}
      </main>
      
      {/* Admin Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex items-center justify-around py-3 px-6">
        <div className="w-1/3">
          <Link href="/admin/dashboard">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              location === "/admin/dashboard" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">dashboard</span>
              <span className="text-xs mt-1">اللوحة</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/3">
          <Link href="/admin/users">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              location === "/admin/users" ? "text-primary" : "text-neutral-500"
            )}>
              <span className="material-icons">people</span>
              <span className="text-xs mt-1">الفنيين</span>
            </div>
          </Link>
        </div>
        
        <div className="w-1/3">
          <Link href="/admin/settings">
            <div className={cn(
              "flex flex-col items-center cursor-pointer",
              location === "/admin/settings" ? "text-primary" : "text-neutral-500"
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
