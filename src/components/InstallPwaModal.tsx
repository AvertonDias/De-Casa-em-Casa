
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import Image from 'next/image';

const SESSION_DISMISSED_KEY = 'pwa-install-dismissed-session';

export function InstallPwaModal() {
  const { showInstallPrompt, canPrompt, onInstall, deviceInfo } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const sessionDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    if (showInstallPrompt && !sessionDismissed) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [showInstallPrompt]);

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true');
    setIsOpen(false);
  };

  const instructions = {
    ios: "No Safari, toque no ícone de 'Compartilhar' e depois em 'Adicionar à Tela de Início'.",
    other: "Procure no menu do seu navegador pela opção 'Instalar aplicativo' ou 'Adicionar à tela inicial'."
  };

  const getInstructions = () => {
    if (deviceInfo.isIOS) return instructions.ios;
    return instructions.other;
  };
  
  if (!isOpen) {
    return null;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-md"
        // Impede que o diálogo feche ao clicar fora dele
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center">
            <Image
                src="/images/Ícone_v2.jpg"
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
           <Button variant="ghost" onClick={handleDismiss} className="w-full text-muted-foreground">
            Lembrar mais tarde
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
