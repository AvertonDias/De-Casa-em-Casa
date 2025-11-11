
"use client";

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string; }>;
  prompt(): Promise<void>;
}

const detectUserAgent = () => {
    if (typeof navigator === 'undefined') return { isMobile: false, isIOS: false };
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(userAgent);
    return { isMobile: isIOS || isAndroid, isIOS: isIOS };
};


export const usePWAInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isIOS: false });

  useEffect(() => {
    setDeviceInfo(detectUserAgent());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      // Mostra o botão/modal se o app não estiver em modo standalone e o evento for disparado
      if (window.matchMedia('(display-mode: standalone)').matches === false) {
        setInstallPromptEvent(event as BeforeInstallPromptEvent);
        setShowInstallButton(true);
      }
    };

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobileDevice = detectUserAgent().isMobile;
    
    // Só adiciona o listener se for um dispositivo móvel e o app não estiver instalado
    if (isMobileDevice && !isStandalone) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
    
    // Verifica se já está instalado no carregamento da página
    if(isStandalone) {
        setShowInstallButton(false);
    }
    
    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    
    await installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setInstallPromptEvent(null);
  };
  
  return {
    showInstallButton,
    canPrompt: installPromptEvent !== null,
    deviceInfo,
    onInstall: handleInstallClick
  };
};
