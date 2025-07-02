"use client";

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const isMobileDevice = () => {
    if (typeof navigator !== 'undefined') {
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }
    return false;
};

export const usePWAInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); 
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    // A verificação inicial se o app já está instalado continua aqui.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsAppInstalled(true);
      setInstallPromptEvent(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', () => {});
    };
  }, []);

  const handleInstallClick = async () => {
    // Se o evento estiver disponível, use-o! É a melhor experiência.
    if (installPromptEvent) {
      await installPromptEvent.prompt(); 
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') setIsAppInstalled(true);
      setInstallPromptEvent(null);
    } else {
      // ▼▼▼ LÓGICA DE FALLBACK ▼▼▼
      // Se o evento não estiver disponível (período de carência), mostre instruções.
      alert(
        'Para instalar o aplicativo, toque no menu do seu navegador (os três pontinhos) e procure pela opção "Instalar aplicativo" ou "Adicionar à tela inicial".'
      );
    }
  };
  
  // ▼▼▼ LÓGICA DE RETORNO ATUALIZADA ▼▼▼
  return {
    // Retorna se o app pode ser instalado (sempre que for mobile e não estiver instalado).
    // Não depende mais do evento `installPromptEvent` para ser verdadeiro.
    canInstall: isMobile && !isAppInstalled,
    onInstall: handleInstallClick
  };
};
