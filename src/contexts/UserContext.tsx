"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
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
        const userStatusRTDBRef = ref(rtdb, `/status/${user.uid}`);
        await set(userStatusRTDBRef, null); // Remove o nó do RTDB
    }
    // O onAuthStateChanged listener irá tratar da limpeza dos listeners do firestore
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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      // Limpa listeners antigos antes de configurar novos.
      unsubscribeAllFirestoreListeners();

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const userStatusRTDBRef = ref(rtdb, `/status/${firebaseUser.uid}`);
        const isOfflineForDatabase = { state: 'offline', last_changed: serverTimestamp() };
        const isOnlineForDatabase = { state: 'online', last_changed: serverTimestamp() };
        
        const connectedRef = ref(rtdb, '.info/connected');
        const rtdbListener = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(userStatusRTDBRef).set(isOfflineForDatabase);
                set(userStatusRTDBRef, isOnlineForDatabase);
            }
        });
        firestoreUnsubsRef.current.push(rtdbListener); // Armazena unsub do rtdb

        const userDocListener = onSnapshot(userRef, (docSnap) => {
          const userData = docSnap.exists() ? { uid: firebaseUser.uid, ...docSnap.data() } as AppUser : null;
          
          if (userData?.congregationId) {
            const congRef = doc(db, 'congregations', userData.congregationId);
            const congListener = onSnapshot(congRef, (congSnap) => {
              const congData = congSnap.exists() ? { id: congSnap.id, ...congSnap.data() } as Congregation : null;
              setUser({...userData, congregationName: congData?.name});
              setCongregation(congData);
              if(loading) setLoading(false);
            });
            firestoreUnsubsRef.current.push(congListener); // Armazena unsub da congregação
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
        firestoreUnsubsRef.current.push(userDocListener); // Armazena unsub do usuário

      } else {
        setUser(null);
        setCongregation(null);
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        unsubscribeAllFirestoreListeners();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !pathname) return;
    const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/aguardando-aprovacao');
    
    if (!user) {
      if (isProtectedPage) {
        router.replace('/');
      }
      return; 
    }

    if (user.status === 'pendente') {
      if (pathname !== '/aguardando-aprovacao') {
        router.replace('/aguardando-aprovacao');
      }
      return;
    }

    if (user.status === 'ativo') {
      if (pathname === '/aguardando-aprovacao' || (!isProtectedPage && pathname !== '/sobre')) {
        if (user.role === 'Publicador') {
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
