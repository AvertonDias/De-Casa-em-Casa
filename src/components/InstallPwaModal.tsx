"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Download, Share, ArrowDown } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function InstallPwaModal() {
  const { showInstallButton, canPrompt, onInstall, deviceInfo } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  // Mensagens de instrução específicas para cada plataforma
  const instructions = {
    ios: "No Safari, toque no ícone de 'Compartilhar' e depois em 'Adicionar à Tela de Início'.",
    android: "Toque no botão abaixo ou procure no menu do navegador a opção 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
    other: "Procure no menu do seu navegador pela opção 'Instalar aplicativo' ou 'Adicionar à tela inicial'."
  };

  const getInstructions = () => {
    if (deviceInfo.isIOS) return instructions.ios;
    if (canPrompt) return instructions.android;
    return instructions.other;
  };

  // Se o usuário já dispensou o modal, não exibe novamente
  if (isDismissed) {
    return null;
  }
  
  return (
    <Dialog open={showInstallButton}>
      <DialogContent 
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center">
            <Download size={48} className="text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold mt-4">Instale o Aplicativo</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Tenha a melhor experiência! Instale o "De Casa em Casa" no seu dispositivo para acesso rápido, notificações e uso offline.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 my-4 bg-muted/50 border border-border rounded-lg text-center">
          <p className="font-semibold">Como Instalar:</p>
          <p className="text-muted-foreground text-sm mt-2">{getInstructions()}</p>
          {deviceInfo.isIOS && <Share className="mx-auto mt-3 text-primary" />}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-col sm:space-x-0 gap-2">
          {/* O botão de instalação direta só aparece se o navegador permitir (Android/Chrome) */}
          {canPrompt && (
            <Button onClick={onInstall} className="w-full" size="lg">
              <Download className="mr-2" /> Instalar Agora
            </Button>
          )}
           <Button variant="ghost" onClick={() => setIsDismissed(true)} className="w-full text-muted-foreground">
            Lembrar mais tarde
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
