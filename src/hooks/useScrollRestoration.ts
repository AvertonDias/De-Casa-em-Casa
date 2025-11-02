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

    const handleScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };
    
    // Salva a posição ao rolar
    window.addEventListener("scroll", handleScroll);
    
    // Restaura ao carregar
    const saved = sessionStorage.getItem(key);
    if (saved) {
        // Atraso para garantir que a página esteja renderizada
        setTimeout(() => window.scrollTo(0, Number(saved)), 50);
    }


    // Remove o listener quando sair
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);
}
