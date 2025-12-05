
"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isIOS: false });

  useEffect(() => {
    setDeviceInfo(detectUserAgent());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        setShowInstallPrompt(true);
      }
    };

    const isMobileDevice = detectUserAgent().isMobile;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isMobileDevice && !isStandalone) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
    
    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    // Reavalia a exibição do prompt a cada mudança de rota
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
        setShowInstallPrompt(false);
    } else if (installPromptEvent) {
        setShowInstallPrompt(true);
    }
  }, [pathname, installPromptEvent]);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    
    await installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setInstallPromptEvent(null);
  };
  
  return {
    showInstallPrompt,
    canPrompt: installPromptEvent !== null,
    deviceInfo,
    onInstall: handleInstallClick
  };
};
