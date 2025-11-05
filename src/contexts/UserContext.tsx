
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, enableNetwork, disableNetwork, Timestamp } from 'firebase/firestore';
import { auth, db, app } from '@/lib/firebase';
import type { AppUser, Congregation } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';

// ▼▼▼ IMPORTAÇÕES DO REALTIME DATABASE (COM onValue) ▼▼▼
import { getDatabase, ref, onDisconnect, set, onValue } from 'firebase/database';

const rtdb = getDatabase(app); // Inicializa o RTDB

interface UserContextType {
  user: AppUser | null;
  congregation: Congregation | null;
  loading: boolean;
  logout: () => Promise<void>;
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

  const logout = async () => {
    if (user) {
        // Marca como offline no Firestore antes de desconectar
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await updateDoc(userDocRef, {
                isOnline: false,
                lastSeen: serverTimestamp()
            });
        } catch (e) {
            console.error("Falha ao definir status offline no Firestore antes do logout:", e);
        }
        // Remove a presença do RTDB
        const userStatusRTDBRef = ref(rtdb, `/status/${user.uid}`);
        await set(userStatusRTDBRef, null);
    }
    await signOut(auth);
    router.push('/');
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

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      // Limpa listeners antigos antes de configurar novos.
      unsubscribeAllFirestoreListeners();

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const userDocListener = onSnapshot(userRef, (docSnap) => {
          const rawData = docSnap.data();
          const userData = docSnap.exists() 
            ? { 
                uid: firebaseUser.uid,
                ...rawData,
                name: rawData?.name || firebaseUser.displayName,
                email: rawData?.email || firebaseUser.email,
                whatsapp: rawData?.whatsapp || '',
              } as AppUser
            : null;
          
          if (userData?.congregationId) {
            const congRef = doc(db, 'congregations', userData.congregationId);
            const congListener = onSnapshot(congRef, (congSnap) => {
              const congData = congSnap.exists() ? { id: congSnap.id, ...congSnap.data() } as Congregation : null;
              setUser({...userData, congregationName: congData?.name});
              setCongregation(congData);
              if(loading) setLoading(false);
            }, (error) => {
                console.error("Erro no listener de congregação:", error);
                // Mesmo com erro na congregação, seta o usuário e para de carregar
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

    const isAuthActionPage = pathname.startsWith('/auth/action');
    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/aguardando-aprovacao');
    
    if (!user) {
      if (isProtectedPage && !isAuthActionPage) {
        router.replace('/');
      }
      return; 
    }

    if (user.status === 'pendente') {
      if (pathname !== '/aguardando-aprovacao' && !isAuthActionPage) {
        router.replace('/aguardando-aprovacao');
      }
      return;
    }

    if (user.status === 'ativo') {
      const isInitialRedirect = pathname === '/aguardando-aprovacao' || (!isProtectedPage && pathname !== '/sobre' && !isAuthActionPage);
      if (isInitialRedirect) {
        if (user.role === 'Administrador' || user.role === 'Dirigente' || user.role === 'Servo de Territórios') {
          router.replace('/dashboard');
        } else if (user.role === 'Publicador') {
          router.replace('/dashboard/territorios');
        } else {
          router.replace('/dashboard');
        }
      }
    }
  }, [user, loading, pathname, router]);

  const value = { user, congregation, loading, logout, updateUser };
  
  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader className="animate-spin text-primary" /></div>;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
