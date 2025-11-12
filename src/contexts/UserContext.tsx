
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, enableNetwork, disableNetwork, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, app } from '@/lib/firebase';
import type { AppUser, Congregation } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { subMonths } from 'date-fns';
import { getDatabase, ref, onDisconnect, set, onValue } from 'firebase/database';

const rtdb = getDatabase(app);

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

  const firestoreUnsubsRef = useRef<(() => void)[]>([]);

  const unsubscribeAllFirestoreListeners = () => {
    firestoreUnsubsRef.current.forEach(unsub => unsub());
    firestoreUnsubsRef.current = [];
  };

  const logout = async (redirectPath: string = '/') => {
    if (user) {
        const userStatusRTDBRef = ref(rtdb, `/status/${user.uid}`);
        await set(userStatusRTDBRef, null).catch(e => console.error("Falha ao limpar status no RTDB:", e));
    }
    await signOut(auth).catch(e => console.error("Falha no signOut do Auth:", e));
    router.push(redirectPath);
  };
  
  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) throw new Error("Não é possível atualizar um usuário que não está logado.");
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, data);
  };

  useEffect(() => {
    const handleOnline = () => enableNetwork(db);
    const handleOffline = () => disableNetwork(db);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      unsubscribeAllFirestoreListeners();
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setCongregation(null);
        setLoading(false);
        return;
      }
      
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userUnsub = onSnapshot(userRef, async (userDoc) => {
        if (!userDoc.exists()) {
          const pendingDataStr = sessionStorage.getItem('pendingUserData');
          if (pendingDataStr) {
            try {
              const pendingData = JSON.parse(pendingDataStr);
              await setDoc(userRef, {
                email: firebaseUser.email,
                name: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                ...pendingData,
                createdAt: serverTimestamp(),
                lastSeen: serverTimestamp()
              });
              sessionStorage.removeItem('pendingUserData');
            } catch (error) {
              console.error("Falha ao criar documento de usuário pendente:", error);
              logout('/');
            }
          } else {
            logout('/');
          }
          return;
        }

        const rawData = userDoc.data();
        let appStatus = rawData?.status;
        const oneMonthAgo = subMonths(new Date(), 1);
        if (appStatus === 'ativo' && rawData?.lastSeen && rawData.lastSeen.toDate() < oneMonthAgo) {
          appStatus = 'inativo';
        }
        
        const appUser = { 
          uid: firebaseUser.uid,
          ...rawData,
          status: appStatus,
          name: rawData?.name || firebaseUser.displayName,
          email: rawData?.email || firebaseUser.email,
        } as AppUser;

        if (appUser.status === 'bloqueado' || appUser.status === 'rejeitado') {
            logout('/');
            return;
        }

        setUser(appUser); // Atualiza o usuário primeiro

        if (appUser.congregationId) {
          const congRef = doc(db, 'congregations', appUser.congregationId);
          const congUnsub = onSnapshot(congRef, (congDoc) => {
            if (congDoc.exists()) {
              setCongregation({ id: congDoc.id, ...congDoc.data() } as Congregation);
            } else {
              setCongregation(null);
            }
            setLoading(false);
          }, (error) => {
            console.error("Erro no listener de congregação:", error);
            setCongregation(null);
            setLoading(false);
          });
          firestoreUnsubsRef.current.push(congUnsub);
        } else {
          setCongregation(null);
          setLoading(false);
        }

      }, (error) => {
        console.error("Erro no listener de usuário:", error);
        setUser(null);
        setCongregation(null);
        setLoading(false);
        unsubscribeAllFirestoreListeners();
      });
      firestoreUnsubsRef.current.push(userUnsub);
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
    if (loading) return;
  
    const isAuthPage = ['/', '/cadastro', '/recuperar-senha', '/nova-congregacao'].some(p => p === pathname);
    const isAuthActionPage = pathname?.startsWith('/auth/action');
    const isWaitingPage = pathname === '/aguardando-aprovacao';
    const isAboutPage = pathname === '/sobre';
  
    if (!user) {
      if (!isAuthPage && !isAuthActionPage && !isAboutPage) {
        router.replace('/');
      }
      return;
    }
  
    switch (user.status) {
      case 'pendente':
        if (!isWaitingPage) router.replace('/aguardando-aprovacao');
        break;
      case 'bloqueado':
      case 'rejeitado':
        logout('/');
        break;
      case 'ativo':
      case 'inativo':
        if (isAuthPage || isWaitingPage) {
          const redirectTo = user.role === 'Publicador' ? '/dashboard/territorios' : '/dashboard';
          router.replace(redirectTo);
        }
        break;
      default:
        logout('/');
        break;
    }
  
  }, [user, loading, pathname, router]);

  const value = { user, congregation, loading, logout, updateUser };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
