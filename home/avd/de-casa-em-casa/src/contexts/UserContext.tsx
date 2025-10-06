
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

  const firestoreUnsubsRef = useRef<(() => void)[]>([]);

  const unsubscribeAllFirestoreListeners = () => {
    firestoreUnsubsRef.current.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        console.warn("Erro ao desinscrever listener Firestore:", e);
      }
    });
    firestoreUnsubsRef.current = [];
  };

  const logout = async () => {
    if (user) {
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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
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
        firestoreUnsubsRef.current.push(rtdbListener);

        const userDocListener = onSnapshot(userRef, (docSnap) => {
          const userData = docSnap.exists() ? { uid: firebaseUser.uid, ...docSnap.data() } as AppUser : null;
          
          if (userData?.congregationId) {
            const congRef = doc(db, 'congregations', userData.congregationId);
            const congListener = onSnapshot(congRef, (congSnap) => {
              const congData = congSnap.exists() ? { id: congSnap.id, ...congSnap.data() } as Congregation : null;
              setUser({...userData, congregationName: congData?.name});
              setCongregation(congData);
              setLoading(false);
            });
            firestoreUnsubsRef.current.push(congListener);
          } else {
             setUser(userData);
             setCongregation(null);
             setLoading(false);
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !pathname) return;

    const isAuthPage = ['/', '/cadastro', '/nova-congregacao', '/recuperar-senha', '/auth/action'].includes(pathname);
    const isWaitingPage = pathname === '/aguardando-aprovacao';

    if (!user) {
      if (!isAuthPage && !pathname.startsWith('/sobre')) {
        router.replace('/');
      }
      return;
    }

    if (user.status === 'pendente') {
      if (!isWaitingPage) {
        router.replace('/aguardando-aprovacao');
      }
      return;
    }
    
    if (user.status === 'ativo') {
      if (isWaitingPage || isAuthPage) {
        router.replace('/dashboard');
      }
    }
    
  }, [user, loading, pathname, router]);

  const value = { user, congregation, loading, logout, updateUser };
  
  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader className="animate-spin text-primary" /></div>;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
