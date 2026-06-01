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
        
        // Se for um erro crítico de criação ou exclusão, avisamos o usuário.
        // Se for apenas uma lista (Dashboard), deixamos o log organizacional resolver.
      }
    });
  }, []);

  return null;
}