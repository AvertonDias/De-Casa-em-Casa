
"use client";

import { useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext'; 
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app, rtdb } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export const usePresence = () => {
  useEffect(() => {
    let unsubscribeFromAuth: () => void;
    let listener: () => void;

    // A função principal que gerencia a presença
    const managePresence = (firebaseUser: User | null) => {
      // Se não houver usuário, ou se o listener já existir, retorne
      if (!firebaseUser || listener) {
        return;
      }

      // Se o navegador estiver offline, não faça nada.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      const userStatusDatabaseRef = ref(rtdb, `/status/${firebaseUser.uid}`);
      const connectedRef = ref(rtdb, '.info/connected');

      // Cria o listener para o status da conexão
      listener = onValue(connectedRef, (snap) => {
        if (snap.val() === false) {
          return;
        }
        
        onDisconnect(userStatusDatabaseRef).set({
          state: 'offline',
          last_changed: serverTimestamp(),
        }).then(() => {
          set(userStatusDatabaseRef, {
            state: 'online',
            last_changed: serverTimestamp(),
          });
        }).catch(err => {
          console.warn("Falha ao configurar presença on-disconnect:", err);
        });
      });
    };

    // Fica ouvindo as mudanças de autenticação
    unsubscribeFromAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        managePresence(firebaseUser);
      } else {
        // Se o usuário deslogar, limpa o listener de presença
        if (listener) {
          listener(); // Isso desanexa o onValue
        }
      }
    });

    // Função de limpeza para desmontagem do componente
    return () => {
      if (unsubscribeFromAuth) {
        unsubscribeFromAuth();
      }
      if (listener) {
        listener();
      }
    };
  }, []);
};
