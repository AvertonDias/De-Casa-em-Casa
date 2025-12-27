
"use client";

import { useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext'; 
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app, rtdb } from '@/lib/firebase';

export const usePresence = () => {
  const { user } = useUser();

  const updateUserStatus = useCallback(() => {
    if (!user?.uid) return;

    // Se o navegador estiver offline, não faça nada.
    if (!navigator.onLine) {
        return;
    }

    const userStatusDatabaseRef = ref(rtdb, `/status/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === false) {
        // O SDK já trata a reconexão. Não precisamos fazer nada aqui.
        return;
      }
      
      // Quando nos conectamos (ou reconectamos), configuramos o onDisconnect
      // e definimos nosso status como online.
      onDisconnect(userStatusDatabaseRef).set({
        state: 'offline',
        last_changed: serverTimestamp(),
      }).then(() => {
        set(userStatusDatabaseRef, {
          state: 'online',
          last_changed: serverTimestamp(),
        });
      }).catch(err => {
          // Este erro pode acontecer se a rede cair entre o onDisconnect e o set
          console.warn("Falha ao configurar presença on-disconnect (pode ser problema de rede):", err);
      });
    });

    return () => listener(); // Retorna a função de unsubscribe do listener
  }, [user?.uid]);


  useEffect(() => {
    // Inicia o sistema de presença
    const unsubscribePresence = updateUserStatus();
    
    // Limpeza: remove o listener quando o componente desmontar
    return () => {
      if (unsubscribePresence) {
        unsubscribePresence();
      }
    };
  }, [updateUserStatus]);
};
