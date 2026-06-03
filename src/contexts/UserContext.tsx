"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut, getRedirectResult } from 'firebase/auth';
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

  // 1. Processar resultados de login por redirecionamento (essencial para Google Mobile)
  useEffect(() => {
    const handleRedirect = async () => {
        try {
            const result = await getRedirectResult(auth);
            if (result?.user) {
                console.log("Login via Google processado com sucesso.");
            }
        } catch (error: any) {
            console.error("Erro ao processar retorno do Google:", error);
        }
    };
    handleRedirect();
  }, []);

  // 2. Monitorar estado de autenticação e carregar perfil
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
      
      // Se já temos um listener ativo para este usuário, não criamos outro
      if (listenersRef.current.user) listenersRef.current.user();

      listenersRef.current.user = onSnapshot(userRef, 
        async (userDoc) => {
          if (!userDoc.exists()) {
            const partialUser: AppUser = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Novo Usuário',
                email: firebaseUser.email || '',
                status: 'pendente'
            } as AppUser;
            setUser(partialUser);
            setLoading(false);
            return;
          }

          const rawData = userDoc.data();
          const appUser = { 
            uid: firebaseUser.uid, 
            ...rawData,
            name: rawData?.name || firebaseUser.displayName || 'Usuário', 
            email: rawData?.email || firebaseUser.email || '',
          } as AppUser;

          if (appUser.status === 'bloqueado' || appUser.status === 'rejeitado') {
              unsubscribeAll();
              localStorage.removeItem(USER_CACHE_KEY);
              await signOut(auth);
              setUser(null);
              setCongregation(null);
              setLoading(false);
              return;
          }
          
          setUser(appUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(appUser));
          
          // Se o usuário já está vinculado a uma congregação, buscamos os dados dela
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
                setLoading(false); // Só terminamos o loading aqui para garantir consistência
              }, 
              async (error) => {
                console.warn("Erro ao ouvir dados da congregação:", error);
                setLoading(false);
              }
            );
          } else {
              setCongregation(null);
              setLoading(false);
          }
        }, 
        async (error) => {
          console.error("Erro no listener de perfil:", error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAll();
    };
  }, []);

  // 3. Lógica de Redirecionamento (Navegação baseada em Status)
  useEffect(() => {
    if (loading) return; 
  
    const currentPath = pathname || '/';
    const isAuthPage = ['/', '/cadastro', '/recuperar-senha', '/nova-congregacao'].some(p => p === currentPath);
    const isAuthActionPage = currentPath.startsWith('/auth/action');
    const isWaitingPage = currentPath === '/aguardando-aprovacao';
    const isCompleteProfilePage = currentPath === '/completar-perfil';
  
    // Usuário não logado: deve estar nas páginas de Auth
    if (!user) {
      if (!isAuthPage && !isAuthActionPage && !isWaitingPage && !isCompleteProfilePage) {
        router.replace('/');
      }
      return;
    }
  
    // Usuário logado mas sem perfil/congregação: deve ir para onboarding
    if (!user.congregationId) {
        if (!isCompleteProfilePage) {
            const savedIntent = localStorage.getItem('google_auth_intent');
            if (savedIntent === 'join') {
                router.replace('/completar-perfil?mode=join');
            } else if (savedIntent === 'create') {
                router.replace('/completar-perfil?mode=create');
            } else {
                router.replace('/completar-perfil');
            }
            localStorage.removeItem('google_auth_intent');
        }
        return;
    }
  
    // Usuário logado com congregação: filtrar por status
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

  if (loading) {
    return <LoadingScreen />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}