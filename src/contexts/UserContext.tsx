"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
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
      if (firebaseUser && firebaseUser.email) { // Garante que o usuário tem um e-mail
        try {
          // Em vez de um 'get' direto, fazemos uma consulta pelo e-mail
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where("email", "==", firebaseUser.email));
          const userQuerySnapshot = await getDocs(q);

          if (!userQuerySnapshot.empty) {
            const userSnap = userQuerySnapshot.docs[0];
            const userData = userSnap.data();
            setUser({
              uid: firebaseUser.uid,
              name: userData.name,
              email: firebaseUser.email,
              role: userData.role,
              congregationId: userData.congregationId || null,
              status: userData.status || 'ativo',
            });
          } else {
             console.warn(`Nenhum documento de usuário encontrado para o e-mail: ${firebaseUser.email}`);
             setUser(null);
          }
        } catch (error) {
          console.error("Erro ao buscar dados do usuário:", error);
          setUser(null);
        }
      } else {
        // Trata o logout ou usuários sem e-mail (anônimos, etc.)
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
