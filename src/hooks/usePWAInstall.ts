
"use client";

import { useState, useEffect } from 'react';

// A interface do evento não muda.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string; }>;
  prompt(): Promise<void>;
}

// A função de detecção do agente do usuário continua a mesma.
const detectUserAgent = () => {
    if (typeof navigator === 'undefined') return { isMobile: false, isIOS: false };
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(userAgent);
    return { isMobile: isIOS || isAndroid, isIOS: isIOS };
};


export const usePWAInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(true); // Começa como true por padrão
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isIOS: false });

  useEffect(() => {
    setDeviceInfo(detectUserAgent());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); 
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    // Verifica o modo de display APENAS no lado do cliente
    if (typeof window !== 'undefined') {
        if (window.matchMedia('(display-mode: standalone)').matches) {
          setIsAppInstalled(true);
        } else {
          setIsAppInstalled(false);
        }
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
    // Esta função só deve ser chamada se 'canPrompt' for verdadeiro.
    if (!installPromptEvent) return;
    
    await installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') setIsAppInstalled(true);
    setInstallPromptEvent(null);
  };
  
  // ▼▼▼ LÓGICA DE RETORNO ATUALIZADA E UNIVERSAL ▼▼▼
  return {
    // 'showInstallButton' é verdadeiro para qualquer celular que não tenha o app instalado.
    showInstallButton: deviceInfo.isMobile && !isAppInstalled, 
    // 'canPrompt' nos diz se podemos usar o atalho de instalação nativo (só Chromium).
    canPrompt: installPromptEvent !== null,
    // 'deviceInfo' nos dá o contexto sobre qual mensagem de instrução mostrar.
    deviceInfo: deviceInfo,
    onInstall: handleInstallClick
  };
};
