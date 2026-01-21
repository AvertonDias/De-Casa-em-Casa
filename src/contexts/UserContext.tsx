
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDoc, setDoc, collection, query, getDocs, addDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, Congregation, Territory } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { subMonths } from 'date-fns';
import { LoadingScreen } from '@/components/LoadingScreen';
import { usePresence } from '@/hooks/usePresence';


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
  
  usePresence(); // Ativa o sistema de presença para o usuário logado
  
  const listenersRef = useRef<{ [key: string]: () => void }>({});

  const unsubscribeAll = () => {
    Object.values(listenersRef.current).forEach(unsub => unsub());
    listenersRef.current = {};
  };

  const logout = async (redirectPath: string = '/') => {
    await signOut(auth).catch(e => console.error("Falha no signOut do Auth:", e));
    
    setUser(null);
    setCongregation(null);
    unsubscribeAll();

    router.push(redirectPath);
  };
  
  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) throw new Error("Não é possível atualizar um usuário que não está logado.");
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, data);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      unsubscribeAll();
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setCongregation(null);
        setLoading(false);
        return;
      }
      
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      listenersRef.current.user = onSnapshot(userRef, async (userDoc) => {
        if (!userDoc.exists()) {
            // This case should ideally not happen for a new user if the signup flow works correctly.
            // It might happen if an admin deletes the user doc but not the auth user.
            // Logging out is a safe way to handle this inconsistent state.
            console.warn(`User document for UID ${firebaseUser.uid} not found. Logging out.`);
            logout('/');
            setLoading(false);
            return;
        }

        const rawData = userDoc.data();
        
        const appUser = { 
          uid: firebaseUser.uid, ...rawData,
          name: rawData?.name || firebaseUser.displayName, email: rawData?.email || firebaseUser.email,
        } as AppUser;

        if (appUser.status === 'bloqueado' || appUser.status === 'rejeitado') {
            logout('/');
            setLoading(false);
            return;
        }
        
        if (listenersRef.current.congregation) {
            listenersRef.current.congregation();
            delete listenersRef.current.congregation;
            setCongregation(null);
        }
        
        if (listenersRef.current.overdueListener) {
            listenersRef.current.overdueListener();
            delete listenersRef.current.overdueListener;
        }
        
        if (appUser.congregationId) {
          const congRef = doc(db, 'congregations', appUser.congregationId);
          listenersRef.current.congregation = onSnapshot(congRef, (congDoc) => {
            if (congDoc.exists()) {
              const congData = { id: congDoc.id, ...congDoc.data() } as Congregation;
              setCongregation(congData);
              // Atualiza o nome da congregação no usuário, mantendo o usuário atualizado
              setUser({ ...appUser, congregationName: congData.name });
            } else {
              setCongregation(null);
              setUser(appUser); // Garante que o usuário seja definido mesmo sem congregação
            }
            setLoading(false); 
          }, (error) => {
            console.error("Erro no listener de congregação:", error);
            setCongregation(null);
            setUser(appUser);
            setLoading(false);
          });

          // Lógica para verificar territórios atrasados
          const assignedTerritoriesQuery = query(
              collection(db, 'congregations', appUser.congregationId, 'territories'),
              where("assignment.uid", "==", appUser.uid)
          );
          
          listenersRef.current.overdueListener = onSnapshot(assignedTerritoriesQuery, (snapshot) => {
              snapshot.docs.forEach(async (territoryDoc) => {
                  const territory = { id: territoryDoc.id, ...territoryDoc.data() } as Territory;
                  
                  const isOverdue = territory.assignment && territory.assignment.dueDate.toDate() < new Date();

                  if (isOverdue) {
                      const notificationsRef = collection(db, `users/${appUser.uid}/notifications`);
                      const territoryLink = territory.type === 'rural' ? `/dashboard/rural/${territory.id}` : `/dashboard/territorios/${territory.id}`;
                      
                      // Evita spam de notificações verificando se já existe uma recente
                      const qNotif = query(notificationsRef, where("link", "==", territoryLink));
                      const existingNotifsSnapshot = await getDocs(qNotif);
                      
                      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                      
                      const recentOverdueNotificationExists = existingNotifsSnapshot.docs.some(doc => {
                          const data = doc.data();
                          return data.type === 'territory_overdue' &&
                                 data.createdAt &&
                                 data.createdAt.toDate() > twentyFourHoursAgo;
                      });

                      if (!recentOverdueNotificationExists) {
                          await addDoc(notificationsRef, {
                              title: "Território Atrasado",
                              body: `O território "${territory.number} - ${territory.name}" está com a devolução atrasada.`,
                              link: territoryLink,
                              type: 'territory_overdue',
                              isRead: false,
                              createdAt: serverTimestamp()
                          });
                      }
                  }
              });
          });

        } else {
            setCongregation(null);
            setUser(appUser);
            setLoading(false);
        }

      }, (error) => {
        console.error("Erro no listener de usuário:", error);
        setUser(null); setCongregation(null); setLoading(false); unsubscribeAll();
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAll();
    };
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
          // Lógica de redirecionamento corrigida
          const redirectTo = user.role === 'Administrador' ? '/dashboard' : '/dashboard/territorios';
          router.replace(redirectTo);
        }
        break;
      default:
        logout('/');
        break;
    }
  
  }, [user, loading, pathname, router, logout]);

  const value = { user, congregation, loading, logout, updateUser };

  if (loading) {
    return <LoadingScreen />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
