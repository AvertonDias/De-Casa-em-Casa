"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          // Registra o Service Worker principal
          const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('Service Worker registrado com sucesso:', registration.scope);
        } catch (err) {
          console.warn('Registro de /sw.js falhou:', err);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}

