
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; 
import { auth, db, functions } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import type { AppUser } from '@/types/types';
import { httpsCallable } from 'firebase/functions';

// Obtenha a URL da função de um jeito mais seguro
const setUserOfflineFunctionUrl = process.env.NEXT_PUBLIC_SET_USER_OFFLINE_URL;

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AppUser>) => void;
}

export const UserContext = createContext<UserContextType>({ user: null, loading: true, updateUser: () => {}, logout: async () => {} });

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
    }
    await signOut(auth);
    // Redirecionamento explícito após o logout
    router.push('/');
  };

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      let firestoreUnsubscribe: () => void = () => {};

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Marcar como online ao carregar
        updateDoc(userRef, { isOnline: true });

        firestoreUnsubscribe = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            let congregationName: string | null = null;
            if (userData.congregationId) { 
              try {
                const congregationRef = doc(db, 'congregations', userData.congregationId);
                const congregationSnap = await getDoc(congregationRef);
                if (congregationSnap.exists()) congregationName = congregationSnap.data().name;
              } catch(error) {
                console.error("Não foi possível buscar os dados da congregação.", error);
              }
            }
            
            const appUser: AppUser = {
              uid: firebaseUser.uid, name: userData.name || firebaseUser.displayName, email: userData.email || firebaseUser.email,
              role: userData.role, status: userData.status, congregationId: userData.congregationId,
              congregationName: congregationName, isOnline: userData.isOnline, lastSeen: userData.lastSeen
            };
            setUser(appUser);
          } else {
            auth.signOut();
            setUser(null);
          }
          setLoading(false); 
        });

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (setUserOfflineFunctionUrl) {
                const data = JSON.stringify({ uid: firebaseUser.uid });
                navigator.sendBeacon(setUserOfflineFunctionUrl, new Blob([data], { type: 'application/json' }));
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            firestoreUnsubscribe();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };

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

    const publicPages = ['/', '/nova-congregacao'];
    const authPages = ['/cadastro', '/recuperar-senha'];
    const isPublicPage = publicPages.includes(pathname) || authPages.some(p => pathname.startsWith(p));
    
    if (!user && !isPublicPage) {
      router.replace('/');
    } 
    else if (user && (pathname === '/' || authPages.some(p => pathname.startsWith(p)))) {
        // Redireciona o usuário para a página correta com base no seu perfil
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

  const value = { user, loading, updateUser, logout };

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
