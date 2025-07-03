"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
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
  const router = useRouter();

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      let firestoreUnsubscribe: () => void = () => {};

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        firestoreUnsubscribe = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // LÓGICA DE REDIRECIONAMENTO CORRIGIDA E FINAL
            // Só redirecionamos quando o usuário é carregado pela primeira vez.
            if (loading) {
              // Se o usuário já for 'ativo', o levamos para sua página inicial correta.
              if (userData.status === 'ativo') {
                if (userData.role === 'Publicador') {
                  router.replace('/dashboard/territorios');
                } else {
                  // Admins e Dirigentes vão para o painel principal.
                  router.replace('/dashboard');
                }
              }
              // Se o status for 'pendente', NÃO fazemos nada. Deixamos ele entrar no dashboard
              // para ver as telas de acesso restrito.
            }

            let congregationName: string | null = null;
            if (userData.congregationId) {
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

            setUser({
              uid: firebaseUser.uid,
              name: userData.name,
              email: firebaseUser.email,
              role: userData.role,
              status: userData.status,
              congregationId: userData.congregationId,
              congregationName: congregationName,
            });
            setLoading(false);

          } else {
            // Documento não encontrado, desloga
            auth.signOut();
            setLoading(false);
          }
        }, (error) => {
           console.error("Erro no listener do usuário:", error);
           auth.signOut();
           setLoading(false);
        });

      } else {
        setUser(null);
        setLoading(false);
      }
      
      return () => firestoreUnsubscribe();
    });
    
    return () => authUnsubscribe();
  }, [router, loading]); // Dependências do useEffect

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
