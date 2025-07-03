"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation'; // Adicionamos usePathname

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
  const pathname = usePathname(); // Pega a rota atual

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      let firestoreUnsubscribe: () => void = () => {};

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        firestoreUnsubscribe = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();

            // A lógica de carregar os dados do usuário e da congregação
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
            
            // ▼▼▼ LÓGICA DE REDIRECIONAMENTO INTELIGENTE (ATUALIZADA) ▼▼▼
            // Só redirecionamos se o usuário estiver em uma página "base" (login ou painel principal)
            const isAtBaseRoute = pathname === '/dashboard' || pathname === '/';
            
            if (loading && isAtBaseRoute) {
              if (userData.status === 'ativo') {
                if (userData.role === 'Publicador') {
                  // Se for publicador, VAI PARA OS TERRITÓRIOS
                  router.replace('/dashboard/territorios');
                } else {
                  // Admins e Dirigentes podem ficar no painel principal
                  router.replace('/dashboard');
                }
              }
            }

            setLoading(false);

          } else {
            // Documento do usuário não encontrado no Firestore.
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
  }, []); // A dependência do router foi removida para simplificar e evitar loops

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
