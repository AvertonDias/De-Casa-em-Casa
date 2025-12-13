
"use client";

import { useModal } from "@/contexts/ModalContext";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect } from "react";

export default function AndroidBackHandler() {
  const { hasOpenModal, closeTopModal } = useModal();

  // Hook genérico para fechar o modal mais alto na pilha
  useAndroidBack({
    enabled: hasOpenModal,
    onClose: closeTopModal,
  });

  // Listener de baixo nível para minimizar o app
  useEffect(() => {
    let listenerHandle: any;

    const setupAppListener = async () => {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
            listenerHandle = await CapacitorApp.addListener('backButton', (e) => {
                // Se NÃO houver modal aberto e a página NÃO puder voltar, minimiza.
                if (!hasOpenModal && !e.canGoBack) {
                    CapacitorApp.minimizeApp();
                }
            });
        }
    };

    setupAppListener();

    return () => {
        listenerHandle?.remove();
    }
  }, [hasOpenModal]);


  return null;
}
