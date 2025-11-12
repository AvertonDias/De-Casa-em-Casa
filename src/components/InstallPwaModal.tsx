
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import Image from 'next/image';

export function InstallPwaModal() {
  const { showInstallButton, canPrompt, onInstall, deviceInfo } = usePWAInstall();
  
  // O modal é controlado diretamente pelo `showInstallButton`
  const [isOpen, setIsOpen] = useState(showInstallButton);

  // Sincroniza o estado do modal com o hook
  useState(() => {
    setIsOpen(showInstallButton);
  });

  const instructions = {
    ios: "No Safari, toque no ícone de 'Compartilhar' e depois em 'Adicionar à Tela de Início'.",
    other: "Procure no menu do seu navegador pela opção 'Instalar aplicativo' ou 'Adicionar à tela inicial'."
  };

  const getInstructions = () => {
    if (deviceInfo.isIOS) return instructions.ios;
    return instructions.other;
  };
  
  // Não renderiza nada se o botão de instalar não deve ser mostrado
  if (!showInstallButton) {
    return null;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex justify-center">
            <Image
                src="/images/icon-512x512.jpg"
                alt="Logo De Casa em Casa"
                width={80}
                height={80}
                className="rounded-2xl"
            />
          </div>
          <DialogTitle className="text-center text-2xl font-bold mt-4">Instale o Aplicativo</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Tenha a melhor experiência! Instale o "De Casa em Casa" no seu dispositivo para acesso rápido, notificações e uso offline.
          </DialogDescription>
        </DialogHeader>

        {canPrompt ? (
           <div className="pt-4">
              <Button onClick={onInstall} className="w-full" size="lg">
                <Download className="mr-2" /> Instalar Agora
              </Button>
           </div>
        ) : (
          <div className="p-4 my-4 bg-muted/50 border border-border rounded-lg text-center">
            <p className="font-semibold">Como Instalar:</p>
            <p className="text-muted-foreground text-sm mt-2">{getInstructions()}</p>
            {deviceInfo.isIOS && <Share className="mx-auto mt-3 text-primary" />}
          </div>
        )}
        
        <DialogFooter className="sm:justify-center pt-2">
           <Button variant="ghost" onClick={() => setIsOpen(false)} className="w-full text-muted-foreground">
            Lembrar mais tarde
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
