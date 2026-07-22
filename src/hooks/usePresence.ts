
"use client";

import { useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { auth, rtdb } from '@/lib/firebase';

export const usePresence = () => {
  useEffect(() => {
    const managePresence = (firebaseUser: User | null) => {
      if (!firebaseUser) return;

      const userStatusDatabaseRef = ref(rtdb, `/status/${firebaseUser.uid}`);
      const connectedRef = ref(rtdb, '.info/connected');

      const listener = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
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
        }
      });
      
      // Retorna a função de limpeza para o onValue
      return listener;
    };

    const unsubscribeAuth = onAuthStateChanged(auth, managePresence);

    // A função de limpeza do useEffect cuidará de tudo
    return () => {
      unsubscribeAuth();
      // Não é mais necessário chamar a limpeza do listener aqui,
      // pois a closure do onAuthStateChanged cuidará disso se necessário.
    };
  }, []);
};
