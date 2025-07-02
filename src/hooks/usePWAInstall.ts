"use client";

import { useState, useEffect } from 'react';

// A interface do evento não muda.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string; }>;
  prompt(): Promise<void>;
}

// ▼▼▼ FUNÇÕES HELPER ATUALIZADAS ▼▼▼
const detectUserAgent = () => {
    if (typeof navigator === 'undefined') {
        return { isMobile: false, isIOS: false };
    }
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(userAgent);
    
    return {
        isMobile: isIOS || isAndroid,
        isIOS: isIOS,
    };
};


export const usePWAInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  // ▼▼▼ MUDANÇA: AGORA GUARDAMOS O TIPO DE DISPOSITIVO ▼▼▼
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isIOS: false });

  useEffect(() => {
    // Detecta o tipo de dispositivo na montagem
    setDeviceInfo(detectUserAgent());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); 
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

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
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') setIsAppInstalled(true);
      setInstallPromptEvent(null);
    }
  };
  
  // ▼▼▼ LÓGICA DE RETORNO ATUALIZADA E MAIS RICA ▼▼▼
  return {
    // Mostra o botão se for um dispositivo móvel e o app não estiver instalado.
    showInstallButton: deviceInfo.isMobile && !isAppInstalled, 
    // Informa se podemos usar o prompt automático (só funciona no Android/Desktop).
    canPrompt: installPromptEvent !== null,
    // Informa se o dispositivo é iOS, para que a UI possa mostrar a mensagem correta.
    isIOS: deviceInfo.isIOS,
    onInstall: handleInstallClick
  };
};