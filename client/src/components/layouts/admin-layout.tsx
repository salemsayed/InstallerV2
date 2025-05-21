import { ReactNode, useState } from "react";
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
import { Menu, X } from "lucide-react";
import { VersionDisplay } from "../version-display";

interface AdminLayoutProps {
  children: ReactNode;
  className?: string;
  activeTab?: string;
  onTabChange?: (value: string) => void;
}

interface NavItemProps {
  href: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

// Helper component for navigation items
function NavItem({ href, label, isActive, onClick }: NavItemProps) {
  return (
    <Link 
      href={href}
      onClick={onClick}
      className={cn(
        "block px-4 py-2 text-white border-b-2 transition-colors",
        isActive 
          ? "border-white" 
          : "border-transparent hover:text-white/80 text-white/70"
      )}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ 
  children, 
  className,
  activeTab = "overview",
  onTabChange
}: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (value: string) => {
    if (onTabChange) {
      onTabChange(value);
    }
    setMobileMenuOpen(false);
  };

  // Navigation items data
  const navItems = [
    { id: "overview", label: "نظرة عامة", href: "/admin/dashboard" },
    { id: "users", label: "المستخدمين", href: "/admin/users" }, 
    { id: "products", label: "المنتجات", href: "/admin/dashboard" },
    { id: "badges", label: "الشارات", href: "/admin/dashboard" },
  ];

  return (
    <div className={cn("min-h-screen bg-neutral-50", className)}>
      {/* Admin Header */}
      <header className="bg-primary text-white shadow-sm" dir="rtl">
        <div className="px-4 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <img src={breegLogo} alt="بريق" className="h-6 ml-2" />
            <span className="font-bold">لوحة الإدارة</span>
          </div>
          
          <div className="flex items-center space-x-reverse space-x-2">
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-full text-white ml-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-white">
                  <span className="material-icons">more_vert</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
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
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pb-2 bg-primary-dark" dir="rtl">
            <nav className="flex flex-col">
              {navItems.map(item => (
                <NavItem 
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  isActive={activeTab === item.id}
                  onClick={() => handleTabChange(item.id)}
                />
              ))}
            </nav>
          </div>
        )}
        
        {/* Desktop Navigation */}
        <div className="hidden md:block px-4 pb-2">
          <div className="w-full" dir="rtl">
            <nav className="flex bg-transparent w-full border-b border-white/20">
              {navItems.map(item => (
                <div key={item.id} className="flex-1 text-center">
                  <NavItem 
                    href={item.href}
                    label={item.label}
                    isActive={activeTab === item.id}
                    onClick={() => handleTabChange(item.id)}
                  />
                </div>
              ))}
            </nav>
          </div>
        </div>
      </header>
      
      {/* Admin Content */}
      <main className="p-4">
        {children}
      </main>
      
      {/* Footer with version */}
      <footer className="p-4 border-t mt-auto">
        <div className="container mx-auto text-center">
          <VersionDisplay className="text-gray-400" />
        </div>
      </footer>
    </div>
  );
}
