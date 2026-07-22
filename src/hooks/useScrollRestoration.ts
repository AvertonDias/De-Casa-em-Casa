
"use client";

import { useEffect, RefObject } from "react";
import { usePathname } from "next/navigation";

/**
 * Restaura e salva a posição de rolagem de uma página ou container específico.
 * @param ref Opcional: referência para um container com scroll interno.
 */
export function useScrollRestoration(ref?: RefObject<HTMLElement | null>) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const key = `scroll-pos:${pathname}`;
    const saved = sessionStorage.getItem(key);

    // Função para aplicar a rolagem salva
    const applyScroll = (pos: number) => {
      if (ref?.current) {
        ref.current.scrollTo({ top: pos, behavior: "auto" });
      } else {
        window.scrollTo(0, pos);
      }
    };

    // Aplica a posição salva (se existir)
    if (saved) {
      setTimeout(() => applyScroll(Number(saved)), 0);
    }

    // Salva a posição sempre que rolar
    const handleScroll = () => {
      const pos = ref?.current ? ref.current.scrollTop : window.scrollY;
      sessionStorage.setItem(key, String(pos));
    };

    const el = ref?.current ?? window;
    el.addEventListener("scroll", handleScroll);

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [pathname, ref]);
}
