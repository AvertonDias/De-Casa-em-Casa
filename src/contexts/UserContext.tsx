"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// A interface precisa incluir o 'status' para que possamos usá-lo na lógica
interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  role: string;
  status: string; // 'ativo', 'pendente', 'inativo'
  congregationId: string | null;
  congregationName: string | null;
}

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  updateUser: (data: Partial<AppUser>) => void;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true, updateUser: () => {} });

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          let congregationName: string | null = null;
          
          // --- MUDANÇA CRÍTICA FINAL AQUI ---
          // Apenas tentamos buscar os dados da congregação se o usuário estiver ATIVO.
          // Se o status for 'pendente', pulamos este passo para evitar erros de permissão.
          if (userData.status === 'ativo' && userData.congregationId) {
            try {
              const congregationRef = doc(db, 'congregations', userData.congregationId);
              const congregationSnap = await getDoc(congregationRef);
              if (congregationSnap.exists()) {
                congregationName = congregationSnap.data().name;
              }
            } catch(error) {
              console.error("Não foi possível buscar os dados da congregação, mas o usuário está logado.", error);
              // Mesmo se falhar, o login continua.
            }
          }

          setUser({
            uid: firebaseUser.uid,
            name: userData.name,
            email: firebaseUser.email,
            role: userData.role,
            status: userData.status, // Guardamos o status no contexto
            congregationId: userData.congregationId,
            congregationName: congregationName,
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

export const useUser = () => useContext(UserContext);
