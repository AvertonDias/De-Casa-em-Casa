
"use client";

import { useEffect } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { useModal } from '@/contexts/ModalContext'; 

interface UseAndroidBackProps {
  enabled: boolean;
  onClose: () => void;
}

export const useAndroidBack = ({ enabled, onClose }: UseAndroidBackProps) => {
  const { hasOpenModal, closeTopModal } = useModal();

  useEffect(() => {
    let listenerHandle: PluginListenerHandle | undefined;

    const setupListener = async () => {
      // O hook agora só precisa estar habilitado (enabled)
      if (enabled && typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        
        const { App } = await import("@capacitor/app");
        
        listenerHandle = await App.addListener("backButton", (e) => {
          // Adiciona a propriedade canGoBack para a lógica de prioridade
          if (e.canGoBack) {
            window.history.back();
          } else {
            // Se houver um modal global aberto, fecha ele primeiro
            if (hasOpenModal) {
              closeTopModal();
            } else {
              // Caso contrário, executa a ação de fechamento do componente (ex: sidebar)
              onClose();
            }
          }
        });
      }
    };

    setupListener();

    return () => {
      listenerHandle?.remove();
    };
    
  // Adiciona as dependências do novo contexto de modal
  }, [enabled, onClose, hasOpenModal, closeTopModal]);
};
