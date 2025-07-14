"use client";

import { useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase';

// O Realtime Database (RTDB) é inicializado aqui.
// É uma instância separada do Firestore (db).
const rtdb = getDatabase(app);

export const usePresence = () => {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return; // Só roda se o usuário estiver logado.

    // Referência para o local no RTDB onde o status do usuário será salvo.
    // Ex: /status/a1b2c3d4...
    const userStatusDatabaseRef = ref(rtdb, `/status/${user.uid}`);

    // Objeto que será salvo quando o usuário estiver online.
    const isOnlineForDatabase = { 
        state: 'online', 
        last_changed: serverTimestamp(), // Timestamp especial do Firebase.
    };
    
    // Objeto que será salvo quando o usuário desconectar.
    const isOfflineForDatabase = { 
        state: 'offline', 
        last_changed: serverTimestamp(),
    };

    // Referência para o monitor de conexão do próprio Firebase.
    const connectedRef = ref(rtdb, '.info/connected');
    
    const listener = onValue(connectedRef, (snap) => {
      // O valor de 'snap.val()' será true se o cliente estiver conectado.
      if (snap.val() === true) {
        // Se conectou, primeiro define o "testamento":
        // A função onDisconnect() instrui o servidor do Firebase a executar uma operação
        // de escrita (set) no 'userStatusDatabaseRef' quando a conexão for perdida.
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase);
        
        // E então, se marca como online no RTDB.
        set(userStatusDatabaseRef, isOnlineForDatabase);
      }
    });

    return () => {
        // Função de limpeza: remove o listener quando o componente é desmontado
        // ou quando o usuário muda (logout), evitando memory leaks.
        listener();
    };

  }, [user]); // O hook reage a mudanças no objeto 'user' (login/logout).
};
