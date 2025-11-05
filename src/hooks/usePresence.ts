
"use client";

import { useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext'; 
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp, goOffline, goOnline } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const { user } = useUser();

  const updateUserStatus = useCallback(() => {
    if (!user?.uid) return;

    const userStatusDatabaseRef = ref(rtdb, `/status/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === false) {
        // O SDK já lida com o estado offline; podemos retornar aqui.
        return;
      }
      
      // Quando conectado, define a ação a ser tomada no momento da desconexão.
      onDisconnect(userStatusDatabaseRef).set({
        state: 'offline',
        last_changed: serverTimestamp(),
      }).then(() => {
        // Uma vez que a ação de desconexão está garantida, define o status atual como online.
        set(userStatusDatabaseRef, {
          state: 'online',
          last_changed: serverTimestamp(),
        });
      }).catch(err => {
          console.error("Erro ao configurar presença onDisconnect:", err);
      });
    });

    return () => listener(); // Retorna a função para desinscrever do listener do .info/connected
  }, [user?.uid]);


  useEffect(() => {
    // Gerenciadores de estado online/offline do navegador
    const handleOnline = () => goOnline(rtdb);
    const handleOffline = () => goOffline(rtdb);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Inicia o sistema de presença
    const unsubscribePresence = updateUserStatus();
    
    // Limpeza
    return () => {
      if (unsubscribePresence) {
        unsubscribePresence();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateUserStatus]);
};
