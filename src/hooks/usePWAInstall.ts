
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
  const [isAppInstalled, setIsAppInstalled] = useState(true); // INICIA como true para evitar flash do botão
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isIOS: false });

  useEffect(() => {
    setDeviceInfo(detectUserAgent());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); 
      setIsAppInstalled(false); // O prompt apareceu, então o app NÃO está instalado
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    // A verificação `beforeinstallprompt` é a principal forma de saber se é instalável.
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPromptEvent(null);
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // Esta função só deve ser chamada se 'canPrompt' for verdadeiro.
    if (!installPromptEvent) return;
    
    await installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
        // Não precisa fazer nada aqui, o listener 'appinstalled' cuidará disso.
    }
    setInstallPromptEvent(null);
  };
  
  // ▼▼▼ LÓGICA DE RETORNO ATUALIZADA E UNIVERSAL ▼▼▼
  return {
    showInstallButton: deviceInfo.isMobile && !isAppInstalled, 
    canPrompt: installPromptEvent !== null,
    deviceInfo: deviceInfo,
    onInstall: handleInstallClick
  };
};
