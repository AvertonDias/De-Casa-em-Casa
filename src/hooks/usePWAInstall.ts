"use client";

import { useState, useEffect } from 'react';

// A interface para o evento que o navegador nos dá.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  // Estado para guardar o evento de instalação
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  
  // Estado para saber se o app já foi instalado ou se o prompt foi dispensado
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    // Handler para capturar o evento do navegador
    const handleBeforeInstallPrompt = (event: Event) => {
      // Previne o pop-up padrão do navegador
      event.preventDefault(); 
      
      // Salva o evento para podermos usá-lo depois
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      
      console.log("PWA: Evento 'beforeinstallprompt' capturado.");
    };

    // Verifica se o app já está rodando no modo standalone (instalado)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
      console.log("PWA: App já está instalado.");
    }
    
    // Adiciona o listener
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listener para saber quando o app foi instalado com sucesso
    window.addEventListener('appinstalled', () => {
      console.log("PWA: App instalado com sucesso!");
      setIsAppInstalled(true);
      setInstallPromptEvent(null); // Limpa o evento
    });

    // Função de limpeza para remover os listeners quando o componente for desmontado
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', () => {});
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return; // Segurança, caso o evento não esteja pronto

    // Mostra a caixa de diálogo de instalação nativa do navegador
    await installPromptEvent.prompt(); 
    
    // Aguarda a escolha do usuário
    const { outcome } = await installPromptEvent.userChoice;
    
    if (outcome === 'accepted') {
      console.log("PWA: Usuário aceitou a instalação.");
      setIsAppInstalled(true);
    } else {
      console.log("PWA: Usuário recusou a instalação.");
    }

    // Limpa o evento, pois ele só pode ser usado uma vez
    setInstallPromptEvent(null);
  };
  
  // O hook retorna o estado e a função para serem usados na UI
  return {
    canInstall: !isAppInstalled && installPromptEvent !== null,
    onInstall: handleInstallClick
  };
};
