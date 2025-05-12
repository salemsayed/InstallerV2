import { ReactNode } from "react";
import { Link } from "wouter";
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
            <nav className="flex bg-transparent overflow-x-auto w-full border-b border-white/20">
              <div className="flex-1 text-center">
                <Link href="/admin/dashboard"
                  onClick={() => handleTabChange("overview")}
                  className={cn(
                    "block px-4 py-2 text-white border-b-2 transition-colors",
                    activeTab === "overview" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  نظرة عامة
                </Link>
              </div>
              <div className="flex-1 text-center">
                <Link href="/admin/users"
                  onClick={() => handleTabChange("users")}
                  className={cn(
                    "block px-4 py-2 text-white border-b-2 transition-colors",
                    activeTab === "users" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  المستخدمين
                </Link>
              </div>
              <div className="flex-1 text-center">
                <Link href="/admin/dashboard"
                  onClick={() => handleTabChange("products")}
                  className={cn(
                    "block px-4 py-2 text-white border-b-2 transition-colors",
                    activeTab === "products" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  المنتجات
                </Link>
              </div>
              <div className="flex-1 text-center">
                <Link href="/admin/dashboard"
                  onClick={() => handleTabChange("badges")}
                  className={cn(
                    "block px-4 py-2 text-white border-b-2 transition-colors",
                    activeTab === "badges" 
                      ? "border-white" 
                      : "border-transparent hover:text-white/80 text-white/70"
                  )}
                >
                  الشارات
                </Link>
              </div>
            </nav>
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
