"use client";

import { ExternalLink, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full py-6 px-4 border-t border-border/40 mt-auto bg-background/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground text-center">
        <a 
          href="https://aplicativos-ton.vercel.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-primary transition-colors group"
        >
          <ExternalLink size={14} className="group-hover:scale-110 transition-transform" />
          Conheça mais aplicativos
        </a>
        <a 
          href="https://wa.me/5535991210466" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-green-500 transition-colors group"
        >
          <MessageCircle size={14} className="group-hover:scale-110 transition-transform text-green-500" />
          Suporte: (35) 99121-0466
        </a>
      </div>
    </footer>
  );
}
