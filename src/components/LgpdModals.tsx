"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TERMS_OF_USE, PRIVACY_POLICY } from '@/lib/lgpdTexts';
import { Shield, FileText } from 'lucide-react';

interface LgpdModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'terms' | 'privacy';
}

export function LgpdModal({ isOpen, onOpenChange, type }: LgpdModalProps) {
  const isTerms = type === 'terms';
  const title = isTerms ? "Termos de Uso" : "Política de Privacidade";
  const icon = isTerms ? <FileText className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-primary" />;
  const content = isTerms ? TERMS_OF_USE : PRIVACY_POLICY;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] md:max-w-xl p-0 overflow-hidden flex flex-col h-[80vh] md:h-[60vh] rounded-xl">
        <DialogHeader className="p-5 border-b shrink-0 flex flex-row items-center gap-3 space-y-0 bg-muted/30">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            {icon}
          </div>
          <div>
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Leia com atenção as diretrizes de conformidade</p>
          </div>
        </DialogHeader>

        <div className="flex-grow p-6 overflow-y-auto bg-card text-card-foreground text-sm leading-relaxed whitespace-pre-line font-sans scrollbar-thin">
          {content}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 shrink-0 flex gap-2 justify-end">
          <DialogClose asChild>
            <Button type="button" className="font-bold w-full sm:w-auto">Compreendi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
