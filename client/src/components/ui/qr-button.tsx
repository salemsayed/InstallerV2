import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export default function QrButton() {
  return (
    <Link href="/scanner">
      <Button
        className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full shadow-xl bg-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/50 z-10 flex flex-col items-center justify-center border-4 border-white"
        aria-label="صفحة المسح الضوئي"
      >
        <span className="material-icons text-3xl">qr_code_scanner</span>
        <span className="text-[12px] mt-1 font-bold">مسح</span>
      </Button>
    </Link>
  );
}