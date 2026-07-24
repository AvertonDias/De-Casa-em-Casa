"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registrado com sucesso no escopo:', registration.scope);
        })
        .catch((err) => {
          console.warn('Registro de /sw.js falhou:', err);
        });
    }
  }, []);

  return null;
}


