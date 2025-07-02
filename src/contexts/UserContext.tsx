"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// MUDANÇA: IMPORTAR AS FUNÇÕES DE PERSISTÊNCIA E getDoc
import { onAuthStateChanged, User as FirebaseUser, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';

// Interfaces (sem alteração)
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

  useEffect(() => {
    // Definimos uma função de limpeza padrão.
    let unsubscribe = () => {};

    // MUDANÇA CRÍTICA: GARANTIR PERSISTÊNCIA ANTES DO LISTENER
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        // Agora, dentro do .then(), configuramos o listener de estado.
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          let firestoreUnsubscribe: () => void = () => {};

          if (firebaseUser) {
            const userRef = doc(db, 'users', firebaseUser.uid);
            
            firestoreUnsubscribe = onSnapshot(userRef, async (userSnap) => {
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

                setUser({
                  uid: firebaseUser.uid,
                  name: userData.name,
                  email: firebaseUser.email,
                  role: userData.role,
                  status: userData.status,
                  congregationId: userData.congregationId,
                  congregationName: congregationName,
                });

              } else {
                setUser(null);
              }
              setLoading(false);
            }, (error) => {
               console.error("Erro no listener do usuário:", error);
               setLoading(false);
               setUser(null);
            });

          } else {
            setUser(null);
            setLoading(false);
          }
          
          // Retornamos a função para limpar o listener do Firestore.
          return () => {
            firestoreUnsubscribe();
          };
        });
      })
      .catch((error) => {
        console.error("Erro ao configurar a persistência de login:", error);
        setLoading(false);
      });
      
    // Retornamos a função para limpar o listener do Auth quando o componente for desmontado.
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
