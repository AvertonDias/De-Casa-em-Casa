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
  congregationId: string | null; // O ID que queremos!
}

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  updateUser: (data: Partial<AppUser>) => void; // Nova função
}

const UserContext = createContext<UserContextType>({ 
  user: null, 
  loading: true,
  updateUser: () => {} // Função vazia como padrão
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Usuário está logado. Agora buscamos nossos dados extras no Firestore.
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUser({
            uid: firebaseUser.uid,
            name: userData.name,
            email: firebaseUser.email,
            role: userData.role,
            congregationId: userData.congregationId || null, // Garante que seja null se não existir
          });
        } else {
           // Caso raro: usuário no Auth mas não no Firestore.
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

// Hook customizado para facilitar o acesso ao contexto
export const useUser = () => {
  return useContext(UserContext);
};
