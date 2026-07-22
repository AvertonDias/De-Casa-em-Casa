
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useFontSize } from '@/contexts/FontSizeContext';
import { CaseUpper, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface FontSizeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function FontSizeModal({ isOpen, onOpenChange }: FontSizeModalProps) {
  const { scale, setScale, resetFontSize } = useFontSize();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CaseUpper />
            Ajustar Tamanho do Texto
          </DialogTitle>
          <DialogDescription>
            Use o controle deslizante para aumentar ou diminuir o tamanho da fonte em todo o aplicativo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold">A</span>
                <Slider
                    value={[scale]}
                    onValueChange={(value) => setScale(value[0])}
                    min={0.8}
                    max={1.3}
                    step={0.1}
                    aria-label="Ajustar tamanho da fonte"
                />
                <span className="text-xl font-bold">A</span>
                <Button variant="ghost" size="icon" onClick={resetFontSize} title="Resetar tamanho">
                    <RotateCcw className="h-5 w-5 text-muted-foreground"/>
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
