"use client";

import { useEffect } from 'react';
import { useUser } from '@/contexts/UserContext'; 
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);

    // Objetos padronizados para o Realtime Database
    const isOnline = { state: 'online', last_changed: serverTimestamp() };
    const isOffline = { state: 'offline', last_changed: serverTimestamp() };

    const connectedRef = ref(rtdb, '.info/connected');
    
    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Se a conexão for perdida, o Firebase definirá o status como offline.
        // Este é o "testamento" que é executado no servidor do Firebase.
        onDisconnect(userStatusDatabaseRef).set(isOffline);

        // Enquanto estiver conectado, define o status como online.
        set(userStatusDatabaseRef, isOnline);
      }
    });

    // Função de limpeza para quando o componente ou hook for desmontado.
    return () => {
      // Remove o listener para evitar memory leaks.
      listener();
      // Ao deslogar ou fechar a aba, define explicitamente como offline.
      // Isso é mais rápido do que esperar o onDisconnect do servidor.
      set(userStatusDatabaseRef, isOffline);
    };
  }, [user?.uid]); // A dependência é o UID do usuário.
};
