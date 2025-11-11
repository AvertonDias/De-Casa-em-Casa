
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, enableNetwork, disableNetwork, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, app } from '@/lib/firebase';
import type { AppUser, Congregation } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { subMonths } from 'date-fns';

// ▼▼▼ IMPORTAÇÕES DO REALTIME DATABASE (COM onValue) ▼▼▼
import { getDatabase, ref, onDisconnect, set, onValue } from 'firebase/database';

const rtdb = getDatabase(app); // Inicializa o RTDB

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

  // Ref para armazenar funções de unsubscribe de Firestore.
  const firestoreUnsubsRef = useRef<(() => void)[]>([]);

  // Função auxiliar para desinscrever TODOS os listeners Firestore.
  const unsubscribeAllFirestoreListeners = () => {
    firestoreUnsubsRef.current.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        console.warn("Erro ao desinscrever listener Firestore:", e);
      }
    });
    firestoreUnsubsRef.current = []; // Limpa o array.
  };

  const logout = async (redirectPath: string = '/') => {
    if (user) {
        const userStatusRTDBRef = ref(rtdb, `/status/${user.uid}`);
        // Primeiro, remove a presença do RTDB. A Cloud Function cuidará do resto.
        await set(userStatusRTDBRef, null).catch(e => console.error("Falha ao limpar status no RTDB:", e));
    }
    // Agora, faz o signOut do Firebase Auth.
    await signOut(auth).catch(e => console.error("Falha no signOut do Auth:", e));

    // Apenas redireciona. O listener de authState vai limpar o estado do contexto.
    router.push(redirectPath);
  };
  
  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) {
      throw new Error("Não é possível atualizar um usuário que não está logado.");
    }
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, data);
  };

  useEffect(() => {
    // Gerenciador de estado online/offline
    const handleOnline = () => enableNetwork(db);
    const handleOffline = () => disableNetwork(db);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      // Limpa listeners antigos antes de configurar novos.
      unsubscribeAllFirestoreListeners();

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const userDocListener = onSnapshot(userRef, (docSnap) => {
          
          if (!docSnap.exists()) {
            const pendingDataStr = sessionStorage.getItem('pendingUserData');
            if (pendingDataStr) {
                try {
                    const pendingData = JSON.parse(pendingDataStr);
                    setDoc(userRef, {
                        email: firebaseUser.email,
                        name: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        ...pendingData,
                        createdAt: serverTimestamp(),
                        lastSeen: serverTimestamp()
                    });
                    sessionStorage.removeItem('pendingUserData');
                } catch (error) {
                    console.error("Falha ao criar documento do usuário pendente:", error);
                    logout('/');
                }
            } else {
                 // Se o documento realmente não existe e não há dados pendentes, deslogue.
                 logout('/');
            }
            return;
          }

          const rawData = docSnap.data();
          let appStatus = rawData?.status;
          const oneMonthAgo = subMonths(new Date(), 1);
          if (appStatus === 'ativo' && rawData?.lastSeen && rawData.lastSeen.toDate() < oneMonthAgo) {
            appStatus = 'inativo';
          }
          
          const userData = { 
                uid: firebaseUser.uid,
                ...rawData,
                status: appStatus,
                name: rawData?.name || firebaseUser.displayName,
                email: rawData?.email || firebaseUser.email,
                whatsapp: rawData?.whatsapp || '',
                photoURL: rawData?.photoURL || firebaseUser.photoURL,
              } as AppUser;

          if (userData.status === 'bloqueado' || userData.status === 'rejeitado') {
              logout('/');
              return;
          }
          
          if (userData?.congregationId) {
            const congRef = doc(db, 'congregations', userData.congregationId);
            const congListener = onSnapshot(congRef, (congSnap) => {
              const congData = congSnap.exists() ? { id: congSnap.id, ...congSnap.data() } as Congregation : null;
              setUser({...userData, congregationName: congData?.name});
              setCongregation(congData);
              if(loading) setLoading(false);
            }, (error) => {
                console.error("Erro no listener de congregação:", error);
                setUser(userData);
                setCongregation(null);
                setLoading(false);
            });
            firestoreUnsubsRef.current.push(congListener);
          } else {
             setUser(userData);
             setCongregation(null);
             if(loading) setLoading(false);
          }
        }, (error) => {
            console.error("Erro no listener de usuário:", error);
            setLoading(false);
            setUser(null);
            unsubscribeAllFirestoreListeners();
        });
        firestoreUnsubsRef.current.push(userDocListener);

      } else {
        setUser(null);
        setCongregation(null);
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        unsubscribeAllFirestoreListeners();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  

  useEffect(() => {
    if (loading || !pathname) return;
  
    const isAuthPage = pathname === '/' || pathname.startsWith('/cadastro') || pathname.startsWith('/recuperar-senha') || pathname.startsWith('/nova-congregacao');
    const isAuthActionPage = pathname.startsWith('/auth/action');
    const isWaitingPage = pathname === '/aguardando-aprovacao';
  
    if (!user) {
      // Se não há usuário e a página não é uma de autenticação, redireciona para o login
      if (!isAuthPage && !isAuthActionPage) {
        router.replace('/');
      }
      return;
    }
  
    // Se o usuário existe, prossiga com a lógica de status
    switch (user.status) {
      case 'pendente':
        if (!isWaitingPage) {
          router.replace('/aguardando-aprovacao');
        }
        break;
  
      case 'bloqueado':
      case 'rejeitado':
        logout('/');
        break;
  
      case 'ativo':
      case 'inativo':
        if (isAuthPage || isWaitingPage) {
          const redirectTo = user.role === 'Administrador' ? '/dashboard' : '/dashboard/territorios';
          router.replace(redirectTo);
        }
        break;
  
      default:
        // Caso de status desconhecido, deslogar por segurança
        logout('/');
        break;
    }
  
  }, [user, loading, pathname, router]);

  const value = { user, congregation, loading, logout, updateUser };
  
  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader className="animate-spin text-primary" /></div>;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
