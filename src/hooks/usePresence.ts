"use client";

import { useEffect, useContext } from 'react';
import { UserContext } from '@/contexts/UserContext';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const userContext = useContext(UserContext);
  const user = userContext?.user;

  useEffect(() => {
    if (!user?.uid) {
      return; // Garante que temos um UID para trabalhar
    }

    const uid = user.uid;
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);

    const isOnlineForDatabase = { state: 'online', last_changed: serverTimestamp() };
    const isOfflineForDatabase = { state: 'offline', last_changed: serverTimestamp() };

    const connectedRef = ref(rtdb, '.info/connected');
    
    const listener = onValue(connectedRef, (snap) => {
      // Executa apenas quando a conexão é estabelecida
      if (snap.val() === false) {
        return;
      }

      // Em vez de apagar o nó ao desconectar, nós explicitamente ESCREVEMOS o estado offline.
      // Isso evita a condição de corrida.
      onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase)
        .then(() => {
          // Apenas DEPOIS que o "testamento" for registrado com sucesso,
          // nós nos marcamos como online.
          set(userStatusDatabaseRef, isOnlineForDatabase);
        });
    });

    // Função de limpeza que roda quando o usuário faz logout ou o componente é desmontado
    return () => {
        listener(); // Remove o listener da conexão
        // Ao sair de forma limpa, também nos marcamos como offline.
        set(userStatusDatabaseRef, isOfflineForDatabase); 
    };

  }, [user?.uid]); // A dependência continua sendo apenas no ID do usuário.
};
