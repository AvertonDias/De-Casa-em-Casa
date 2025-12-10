
"use client";

import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

interface UseAndroidBackProps {
  /** Se existe modal aberto */
  enabled?: boolean;

  /** Executado quando o modal deve ser fechado */
  onClose?: () => void;
}

export function useAndroidBack({
  enabled = false,
  onClose,
}: UseAndroidBackProps) {
  useEffect(() => {
    let handler: any;

    const setup = async () => {
      try {
        const isNative = CapacitorApp.getInfo ? await CapacitorApp.getInfo() : false;
        if (!isNative) return;
      } catch (e) {
        // Roda no navegador, não faz nada
        return;
      }


      handler = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
        // 1️⃣ Modal aberto = fecha modal
        if (enabled && onClose) {
          onClose();
          return;
        }

        // 2️⃣ Tem histórico = volta página
        if (canGoBack) {
          window.history.back();
          return;
        }

        // 3️⃣ Última tela = sai do app
        CapacitorApp.exitApp();
      });
    };

    setup();

    return () => {
      handler?.remove?.();
    };
  }, [enabled, onClose]);
}
