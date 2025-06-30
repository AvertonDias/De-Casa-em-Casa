"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// --- MUDANÇA AQUI ---
// Adicionamos o campo 'phone' à interface do nosso usuário.
interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  phone: string | null; // <-- NOVO: Agora o app conhece este campo
  congregationId: string | null;
  congregationName?: string | null; // congregationName pode não existir no seu, mas é seguro ter
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
          
          if (userData.status === 'ativo' && userData.congregationId) {
            try {
              const congregationRef = doc(db, 'congregations', userData.congregationId);
              const congregationSnap = await getDoc(congregationRef);
              if (congregationSnap.exists()) {
                congregationName = congregationSnap.data().name;
              }
            } catch(error) {
              console.error("Não foi possível buscar os dados da congregação.", error);
            }
          }

          // --- MUDANÇA AQUI ---
          // Agora, estamos pegando o 'phone' do Firestore e colocando no nosso objeto de usuário.
          setUser({
            uid: firebaseUser.uid,
            name: userData.name,
            email: firebaseUser.email,
            role: userData.role,
            status: userData.status,
            phone: userData.phone || null, // <-- NOVO: Pega o telefone do banco de dados
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