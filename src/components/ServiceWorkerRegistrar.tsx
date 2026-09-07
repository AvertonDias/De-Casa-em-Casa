"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registrado com sucesso no escopo:', registration.scope);
          // Força a checagem imediata de nova versão do sw.js
          registration.update();
        })
        .catch((err) => {
          console.warn('Registro de /sw.js falhou:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}


