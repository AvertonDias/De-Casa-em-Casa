'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

export function FirebaseErrorListener() {
  useEffect(() => {
    errorEmitter.on('permission-error', (error) => {
      // Em desenvolvimento, logamos o erro no console de forma organizada
      // para evitar o crash total da página por permissões parciais negadas.
      if (process.env.NODE_ENV === 'development') {
        console.group('🔥 Erro de Permissão Firestore');
        console.error(error.message);
        console.log('Contexto:', error.context);
        console.groupEnd();
      }
    });

    const handleWindowError = (e: ErrorEvent) => {
      if (
        e.message &&
        (e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
         e.message.includes('ResizeObserver loop limit exceeded'))
      ) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
      }
    };

    window.addEventListener('error', handleWindowError);

    return () => {
      window.removeEventListener('error', handleWindowError);
    };
  }, []);

  return null;
}