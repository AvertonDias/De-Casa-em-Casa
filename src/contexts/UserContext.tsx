"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  role: string;
  congregationId: string | null;
  status: string; // 'ativo', 'pendente', 'rejeitado'
}

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  updateUser: (data: Partial<AppUser>) => void;
}

const UserContext = createContext<UserContextType>({ 
  user: null, 
  loading: true,
  updateUser: () => {}
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUser({
            uid: firebaseUser.uid,
            name: userData.name,
            email: firebaseUser.email,
            role: userData.role,
            congregationId: userData.congregationId || null,
            status: userData.status || 'ativo', // Adiciona status, padrão 'ativo' para compatibilidade
          });
        } else {
           setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUser = (data: Partial<AppUser>) => {
    setUser(currentUser => currentUser ? { ...currentUser, ...data } : null);
  };

  return (
    <UserContext.Provider value={{ user, loading, updateUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  return useContext(UserContext);
};
