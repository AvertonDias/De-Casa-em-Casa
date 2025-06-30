"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Interface expandida para incluir todos os dados necessários
interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  congregationId: string | null;
  congregationName: string | null; // <-- NOVO: Para guardar o nome da congregação
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
        // Passo 1: Buscar os dados do usuário
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          let congregationName: string | null = null;
          
          // --- MUDANÇA CRUCIAL AQUI ---
          // Passo 2: Se o usuário tem um congregationId, buscar APENAS esse documento
          if (userData.congregationId) {
            // Esta é uma consulta específica e segura a um único documento
            const congregationRef = doc(db, 'congregations', userData.congregationId);
            const congregationSnap = await getDoc(congregationRef);
            if (congregationSnap.exists()) {
              congregationName = congregationSnap.data().name;
            }
          }

          setUser({
            uid: firebaseUser.uid,
            name: userData.name,
            email: firebaseUser.email,
            role: userData.role,
            status: userData.status,
            congregationId: userData.congregationId,
            congregationName: congregationName, // <-- Salva o nome no contexto
          });

        } else {
          setUser(null); // Usuário autenticado mas sem perfil no Firestore
        }
      } else {
        setUser(null); // Usuário não está logado
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
