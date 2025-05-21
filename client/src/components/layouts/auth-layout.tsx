import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import breegLogo from "@/assets/breeg-logo.svg";
import { VersionDisplay } from "../version-display";

interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
}

export default function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn("min-h-screen flex flex-col justify-center p-6 bg-neutral-50", className)}>
      <div className="max-w-md mx-auto w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={breegLogo} alt="بريق" className="h-12" />
        </div>
        
        {children}
        
        {/* Version display */}
        <div className="text-center mt-6">
          <VersionDisplay />
        </div>
      </div>
    </div>
  );
}
