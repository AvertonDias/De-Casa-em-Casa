"use client";

import { useEffect, useContext } from 'react'; // Usaremos useContext diretamente aqui
import { UserContext } from '@/contexts/UserContext';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const userContext = useContext(UserContext);
  const user = userContext?.user;

  // ▼▼▼ A CORREÇÃO FUNDAMENTAL ESTÁ AQUI ▼▼▼
  // O useEffect agora depende APENAS do 'user.uid'.
  // Ele só vai rodar quando o usuário mudar (login/logout), 
  // e vai ignorar as atualizações de 'isOnline' ou 'lastSeen'.
  useEffect(() => {
    if (!user) {
      return; // Se não há usuário, não faz nada.
    }

    const uid = user.uid;
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);

    const isOnlineForDatabase = { state: 'online', last_changed: serverTimestamp() };
    const isOfflineForDatabase = { state: 'offline', last_changed: serverTimestamp() };

    const connectedRef = ref(rtdb, '.info/connected');
    
    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Define o "testamento" para ficar offline quando desconectar.
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase);
        
        // Se marca como online.
        set(userStatusDatabaseRef, isOnlineForDatabase);
      }
    });

    // Função de limpeza que roda quando o usuário faz logout.
    return () => {
        listener(); // Remove o listener da conexão
        // Remove o status do usuário do RTDB ao deslogar
        set(userStatusDatabaseRef, isOfflineForDatabase); 
    };

  }, [user?.uid]); // A dependência é apenas no ID do usuário.
};
