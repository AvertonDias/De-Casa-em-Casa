
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import type { AppUser } from '@/types/types';

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  updateUser: (data: Partial<AppUser>) => void;
}

export const UserContext = createContext<UserContextType>({ user: null, loading: true, updateUser: () => {} });

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      let firestoreUnsubscribe: () => void = () => {};

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        firestoreUnsubscribe = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();

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
            
            const appUser: AppUser = {
              uid: firebaseUser.uid,
              name: userData.name || firebaseUser.displayName,
              email: userData.email || firebaseUser.email,
              role: userData.role,
              status: userData.status,
              congregationId: userData.congregationId,
              congregationName: congregationName,
              isOnline: userData.isOnline,
              lastSeen: userData.lastSeen
            };
            setUser(appUser);
          } else {
            auth.signOut();
            setUser(null);
          }
          setLoading(false); 
        }, (error) => {
           console.error("Erro no listener do usuário:", error);
           auth.signOut();
           setUser(null);
           setLoading(false);
        });

        // Set user as online
        updateDoc(userRef, { isOnline: true });

        // Set user as offline on unload
        window.addEventListener('beforeunload', () => {
          updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
        });

      } else {
        setUser(null);
        setLoading(false);
      }
      
      return () => firestoreUnsubscribe();
    });
    
    return () => authUnsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const publicPages = ['/', '/login', '/cadastro', '/solicitar-acesso', '/recuperar-senha', '/nova-congregacao'];
    const isPublicPage = publicPages.includes(pathname);

    if (!user && !isPublicPage) {
      router.replace('/');
    } else if (user && isPublicPage) {
        if (user.role === 'Publicador') {
          router.replace('/dashboard/territorios');
        } else {
          router.replace('/dashboard');
        }
    }
  }, [user, loading, router, pathname]);

  const updateUser = (data: Partial<AppUser>) => {
    setUser(currentUser => currentUser ? { ...currentUser, ...data } : null);
  };

  const value = { user, loading, updateUser };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
