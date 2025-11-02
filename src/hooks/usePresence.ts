
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
      });
    });

    return () => listener();
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
