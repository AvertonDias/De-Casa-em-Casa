"use client";

import { useEffect } from "react";
import { useModal } from "@/contexts/ModalContext";
import { useRouter } from 'next/navigation';

export function useAndroidBack() {
  const { hasOpenModal, closeTopModal } = useModal();
  const router = useRouter();

  useEffect(() => {
    let App: any = null;
    let listenerHandle: any = null;

    if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform()) {
      import("@capacitor/app").then(module => {
        App = module.App;
        if (App) {
          listenerHandle = App.addListener("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
            if (hasOpenModal) {
              closeTopModal();
              return;
            }
            
            if (canGoBack) {
              router.back();
            } else {
              App.exitApp();
            }
          });
        }
      });
    }

    return () => {
      listenerHandle?.remove();
    };
  }, [hasOpenModal, closeTopModal, router]);
}
