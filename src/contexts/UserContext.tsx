
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
  forceStopLoading: () => void;
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
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const forceStopLoading = () => {
    console.warn("Forçando interrupção do carregamento do usuário.");
    setLoading(false);
  };

  // 1. Processar resultados de login por redirecionamento (Google)
  useEffect(() => {
    const handleRedirect = async () => {
        try {
            console.log("Checando resultado de redirecionamento do Google...");
            const result = await getRedirectResult(auth);
            if (result?.user) {
                console.log("Login via Google processado:", result.user.email);
            }
        } catch (error: any) {
            console.error("Erro ao processar retorno do Google:", error);
            setLoading(false);
        }
    };
    
    handleRedirect();
  }, []);

  // 2. Monitorar estado de autenticação e carregar perfil
  useEffect(() => {
    // Seguro contra travamentos: Se nada acontecer em 8 segundos, libera o loading
    initTimeoutRef.current = setTimeout(() => {
        if (loading) {
            console.warn("Timeout de inicialização atingido. Liberando tela.");
            setLoading(false);
        }
    }, 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);

      if (!firebaseUser) {
        console.log("Auth: Nenhum usuário logado.");
        unsubscribeAll();
        localStorage.removeItem(USER_CACHE_KEY);
        setUser(null);
        setCongregation(null);
        setLoading(false);
        return;
      }
      
      console.log("Auth: Usuário autenticado:", firebaseUser.uid);
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      if (listenersRef.current.user) listenersRef.current.user();

      listenersRef.current.user = onSnapshot(userRef, 
        async (userDoc) => {
          if (!userDoc.exists()) {
            console.log("Firestore: Perfil não encontrado, tratando como novo usuário.");
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

          console.log("Firestore: Perfil carregado, status:", appUser.status);

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
              (error) => {
                console.warn("Erro ao ouvir dados da congregação:", error);
                setLoading(false);
              }
            );
          } else {
              setCongregation(null);
              setLoading(false);
          }
        }, 
        (error) => {
          console.error("Erro no listener de perfil:", error);
          // Se não houver permissão para ler o próprio perfil, pode ser erro de regra
          setLoading(false);
        }
      );
    }, (error) => {
        console.error("Erro no Auth Observer:", error);
        setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAll();
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
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
  
    if (!user) {
      if (!isAuthPage && !isAuthActionPage && !isWaitingPage && !isCompleteProfilePage) {
        router.replace('/');
      }
      return;
    }
  
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

  const value = { user, congregation, loading, logout, updateUser, forceStopLoading };

  if (loading) {
    return <LoadingScreen />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
