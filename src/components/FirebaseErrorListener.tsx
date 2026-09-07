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

    // Ouvinte detalhado para falhas no registro de tokens push (FCM / Web Push)
    errorEmitter.on('fcm-token-error', (data) => {
      console.group('🔔 [Push Notifications] Falha no Registro de Token FCM');
      console.error('Mensagem de Erro:', data?.message || 'Erro desconhecido ao obter/salvar token push');
      if (data?.userId) console.log('ID do Usuário:', data.userId);
      if (data?.context) console.log('Etapa/Contexto:', data.context);
      if (data?.permission) console.log('Permissão do Navegador:', data.permission);
      if (data?.swStatus) console.log('Status do Service Worker:', data.swStatus);
      if (data?.error) {
        console.error('Objeto do Erro Original:', data.error);
        if (data.error.code) console.log('Código de Erro Firebase/Browser:', data.error.code);
        if (data.error.stack) console.log('Stack Trace:', data.error.stack);
      }
      console.log('💡 Dica de Diagnóstico: Verifique se o Service Worker (sw.js) está ativo no navegador, se a Chave VAPID está válida e se o Push está habilitado nas configurações do navegador.');
      console.groupEnd();
    });


    const handleWindowError = (e: ErrorEvent) => {
      if (
        e.message &&
        (e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
         e.message.includes('ResizeObserver loop limit exceeded') ||
         e.message.includes('Failed to fetch RSC payload') ||
         e.message.includes('Falling back to browser navigation'))
      ) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || (typeof e.reason === 'string' ? e.reason : '');
      if (
        msg.includes('Failed to fetch RSC payload') ||
        msg.includes('Falling back to browser navigation') ||
        msg.includes('Failed to fetch')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}