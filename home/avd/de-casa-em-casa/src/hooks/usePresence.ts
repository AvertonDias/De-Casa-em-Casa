"use client";

import { useEffect, useContext } from 'react';
import { UserContext } from '@/contexts/UserContext';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp, remove } from 'firebase/database';
import { app } from '@/lib/firebase';

const rtdb = getDatabase(app);

export const usePresence = () => {
  const { user } = useContext(UserContext);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);

    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };
    
    const connectedRef = ref(rtdb, '.info/connected');
    
    const listener = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(userStatusDatabaseRef).remove();
        set(userStatusDatabaseRef, isOnlineForDatabase);
      }
    });

    return () => {
      listener();
    };
  }, [user?.uid]);
};

    