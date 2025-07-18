"use client";

import { useEffect, useContext } from 'react';
import { UserContext } from '@/contexts/UserContext';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const { user } = useContext(UserContext);

  useEffect(() => {
    // A dependência é apenas no UID do usuário, o que quebra o loop de renderização.
    const uid = user?.uid;
    if (!uid) {
      return; // Só roda se tivermos um UID.
    }

    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);

    // Objeto que será salvo quando o usuário estiver online
    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };
    
    // ▼▼▼ O "TESTAMENTO" CORRIGIDO E EXPLÍCITO ▼▼▼
    // Objeto que será salvo quando a conexão cair
    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
    };

    const connectedRef = ref(rtdb, '.info/connected');
    
    const listener = onValue(connectedRef, (snap) => {
      // O 'snap.val()' será 'true' quando o cliente estiver conectado.
      if (snap.val() === true) {
        // Se a conexão for estabelecida:
        // 1. Define o testamento: se a conexão cair, o Firebase salvará 'isOfflineForDatabase'.
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase);
        
        // 2. E então, se marca como online.
        set(userStatusDatabaseRef, isOnlineForDatabase);
      }
    });

    // Função de limpeza que roda quando o componente é desmontado (ex: logout)
    return () => {
      listener(); // Remove o listener da conexão
      // Ao deslogar, força o status para offline no RTDB
      set(userStatusDatabaseRef, isOfflineForDatabase); 
    };

  }, [user?.uid]);
};
