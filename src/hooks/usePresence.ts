"use client";

import { useEffect } from 'react';
import { useUser } from '@/contexts/UserContext'; 
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const { user } = useUser();

  useEffect(() => {
    // Só executa se houver um usuário logado.
    if (!user?.uid) return;

    const uid = user.uid;
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);

    const isOnline = { state: 'online', last_changed: serverTimestamp() };
    const isOffline = { state: 'offline', last_changed: serverTimestamp() };

    const connectedRef = ref(rtdb, '.info/connected');
    
    // onValue retorna uma função de cancelamento de inscrição (unsubscribe)
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Define o status offline como um "testamento" a ser executado no servidor
        // caso a conexão seja perdida abruptamente.
        onDisconnect(userStatusDatabaseRef).set(isOffline);

        // Enquanto conectado, define o status como online.
        set(userStatusDatabaseRef, isOnline);
      }
    });

    // Função de limpeza que é executada quando o componente desmonta
    return () => {
      // Remove o listener para evitar memory leaks.
      unsubscribe();
    };
  }, [user?.uid]); // A dependência é apenas o UID do usuário.
};
