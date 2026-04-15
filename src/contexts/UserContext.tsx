
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, Congregation } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';
import { usePresence } from '@/hooks/usePresence';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const USER_CACHE_KEY = 'decasaemcasa_user_cache';

interface UserContextType {
  user: AppUser | null;
  congregation: Congregation | null;
  loading: boolean;
  logout: (redirectPath?: string) => Promise<void>;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);
export const useUser = () => useContext(UserContext)!;

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [congregation, setCongregation] = useState<Congregation | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  
  usePresence(); 
  
  const listenersRef = useRef<{ [key: string]: () => void }>({});

  const unsubscribeAll = () => {
    Object.values(listenersRef.current).forEach(unsub => unsub());
    listenersRef.current = {};
  };

  const logout = async (redirectPath: string = '/') => {
    unsubscribeAll();
    localStorage.removeItem(USER_CACHE_KEY);
    await signOut(auth).catch(e => console.error("Falha no logout:", e));
    
    setUser(null);
    setCongregation(null);
    router.push(redirectPath);
  };
  
  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) throw new Error("Usuário não logado.");
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, data).catch(async (error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: data,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        }
    });
  };

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setUser(parsed);
        setLoading(false);
      } catch (e) {
        console.warn("Erro ao ler cache do usuário");
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (!firebaseUser) {
        unsubscribeAll();
        localStorage.removeItem(USER_CACHE_KEY);
        setUser(null);
        setCongregation(null);
        setLoading(false);
        return;
      }
      
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      if (listenersRef.current.user) listenersRef.current.user();

      listenersRef.current.user = onSnapshot(userRef, 
        async (userDoc) => {
          if (!userDoc.exists()) {
            const partialUser: AppUser = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Novo Usuário',
                email: firebaseUser.email!,
            } as AppUser;
            setUser(partialUser);
            setLoading(false);
            return;
          }

          const rawData = userDoc.data();
          const appUser = { 
            uid: firebaseUser.uid, ...rawData,
            name: rawData?.name || firebaseUser.displayName, 
            email: rawData?.email || firebaseUser.email,
          } as AppUser;

          if (appUser.status === 'bloqueado' || appUser.status === 'rejeitado') {
              logout('/');
              return;
          }
          
          setUser(appUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(appUser));

          if (appUser.congregationId) {
            const congRef = doc(db, 'congregations', appUser.congregationId);
            
            if (listenersRef.current.congregation) listenersRef.current.congregation();
            
            listenersRef.current.congregation = onSnapshot(congRef, 
              (congDoc) => {
                if (congDoc.exists()) {
                  setCongregation({ id: congDoc.id, ...congDoc.data() } as Congregation);
                } else {
                  setCongregation(null);
                }
                setLoading(false); 
              }, 
              async (error) => {
                setLoading(false);
              }
            );
          } else {
              setCongregation(null);
              setLoading(false);
          }
        }, 
        async (error) => {
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAll();
    };
  }, []);

  useEffect(() => {
    if (loading && !user) return; 
  
    const isAuthPage = ['/', '/cadastro', '/recuperar-senha', '/nova-congregacao'].some(p => p === pathname);
    const isAuthActionPage = pathname?.startsWith('/auth/action');
    const isWaitingPage = pathname === '/aguardando-aprovacao';
    const isCompleteProfilePage = pathname === '/completar-perfil';
  
    if (!user) {
      if (!isAuthPage && !isAuthActionPage && !isCompleteProfilePage) {
        router.replace('/');
      }
      return;
    }
  
    if (!user.congregationId) {
        if (!isCompleteProfilePage) {
            router.replace('/completar-perfil');
        }
        return;
    }
  
    switch (user.status) {
      case 'pendente':
        if (!isWaitingPage) router.replace('/aguardando-aprovacao');
        break;
      case 'ativo':
      case 'inativo':
        if (isAuthPage || isWaitingPage || isCompleteProfilePage) {
          const redirectTo = user.role === 'Administrador' ? '/dashboard' : '/dashboard/territorios';
          router.replace(redirectTo);
        }
        break;
      default:
        break;
    }
  
  }, [user, loading, pathname, router]);

  const value = { user, congregation, loading, logout, updateUser };

  if (loading && !user) {
    return <LoadingScreen />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
