
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Hook para restaurar a posição do scroll ao voltar para uma página.
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const key = `scroll-pos:${pathname}`;
    const saved = sessionStorage.getItem(key);

    // Restaura a posição do scroll ao entrar na página
    if (saved) {
        // Atraso para garantir que a página esteja renderizada
        setTimeout(() => window.scrollTo(0, Number(saved)), 50);
    }


    // Salva a posição ao rolar
    const handleScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener("scroll", handleScroll);

    // Remove o listener quando sair
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);
}
