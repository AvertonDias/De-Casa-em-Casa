"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          // Registro bem sucedido
        }).catch(err => {
          // Erro silencioso para não quebrar a UI em desenvolvimento
          console.warn('SW registration failed (Normal in Dev): ', err.message);
        });
      });
    }
  }, []);

  return null;
}