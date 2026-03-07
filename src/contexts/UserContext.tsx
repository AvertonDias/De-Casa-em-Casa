
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDoc, setDoc, collection, query, getDocs, addDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, Congregation, Territory } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/LoadingScreen';
import { usePresence } from '@/hooks/usePresence';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';


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
    unsubscribeAll();
    await signOut(auth).catch(e => console.error("Falha no signOut do Auth:", e));
    
    setUser(null);
    setCongregation(null);
    router.push(redirectPath);
  };
  
  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) throw new Error("Não é possível atualizar um usuário que não está logado.");
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

  // 1. Ouvinte de Autenticação e Perfil do Usuário
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (!firebaseUser) {
        unsubscribeAll();
        setUser(null);
        setCongregation(null);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      // Encerra ouvintes antigos antes de criar novos para o mesmo usuário
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
            setCongregation(null);
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

          // Ouvinte da Congregação (apenas se mudou ou não existe)
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
                if (error.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: congRef.path,
                        operation: 'get',
                    } satisfies SecurityRuleContext);
                    errorEmitter.emit('permission-error', permissionError);
                }
                setLoading(false);
              }
            );
          } else {
              setCongregation(null);
              setLoading(false);
          }
        }, 
        async (error) => {
          if (error.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                  path: userRef.path,
                  operation: 'get',
              } satisfies SecurityRuleContext);
              errorEmitter.emit('permission-error', permissionError);
          }
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAll();
    };
  }, []);

  // 2. Monitoramento de Territórios Atrasados (Isolado para estabilidade)
  useEffect(() => {
    // Só inicia se o usuário for ATIVO ou tiver cargo de gerência, conforme regras
    const isAuthorized = user?.status === 'ativo' || 
      ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios'].includes(user?.role || '');

    if (!user?.uid || !user?.congregationId || !isAuthorized) {
        if (listenersRef.current.overdueListener) {
            listenersRef.current.overdueListener();
            delete listenersRef.current.overdueListener;
        }
        return;
    }

    const territoryCollectionPath = `congregations/${user.congregationId}/territories`;
    const assignedTerritoriesQuery = query(
        collection(db, territoryCollectionPath),
        where("assignment.uid", "==", user.uid)
    );
    
    // Evita duplicar o listener se ele já estiver ativo para este contexto
    if (listenersRef.current.overdueListener) listenersRef.current.overdueListener();

    listenersRef.current.overdueListener = onSnapshot(assignedTerritoriesQuery, 
      (snapshot) => {
        snapshot.docs.forEach(async (territoryDoc) => {
            const territory = { id: territoryDoc.id, ...territoryDoc.data() } as Territory;
            const isOverdue = territory.assignment && territory.assignment.dueDate.toDate() < new Date();

            if (isOverdue) {
                const notificationsRef = collection(db, `users/${user.uid}/notifications`);
                const territoryLink = territory.type === 'rural' ? `/dashboard/rural/${territory.id}` : `/dashboard/territorios/${territory.id}`;
                
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
                    addDoc(notificationsRef, {
                        title: "Território Atrasado",
                        body: `O território "${territory.number} - ${territory.name}" está com a devolução atrasada.`,
                        link: territoryLink,
                        type: 'territory_overdue',
                        isRead: false,
                        createdAt: serverTimestamp()
                    }).catch(async (notifErr) => {
                        if (notifErr.code === 'permission-denied') {
                            const permissionError = new FirestorePermissionError({
                                path: `users/${user.uid}/notifications`,
                                operation: 'create',
                            } satisfies SecurityRuleContext);
                            errorEmitter.emit('permission-error', permissionError);
                        }
                    });
                }
            }
        });
      },
      async (error) => {
        // Silencia erros de permissão temporários durante trocas de status
        if (error.code === 'permission-denied') {
            console.warn("[OverdueListener] Acesso negado temporariamente.");
        }
      }
    );

    return () => {
        if (listenersRef.current.overdueListener) listenersRef.current.overdueListener();
    };
  }, [user?.uid, user?.congregationId, user?.status, user?.role]);
  
  // 3. Redirecionamentos Automáticos
  useEffect(() => {
    if (loading) return; 
  
    const isAuthPage = ['/', '/cadastro', '/recuperar-senha', '/nova-congregacao'].some(p => p === pathname);
    const isAuthActionPage = pathname?.startsWith('/auth/action');
    const isWaitingPage = pathname === '/aguardando-aprovacao';
    const isCompleteProfilePage = pathname === '/completar-perfil';
    const isAboutPage = pathname === '/sobre';
  
    if (!user) {
      if (!isAuthPage && !isAuthActionPage && !isAboutPage && !isCompleteProfilePage) {
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
      case 'bloqueado':
      case 'rejeitado':
        logout('/');
        break;
      case 'ativo':
      case 'inativo':
        if (isAuthPage || isWaitingPage || isCompleteProfilePage) {
          const redirectTo = user.role === 'Administrador' ? '/dashboard' : '/dashboard/territorios';
          router.replace(redirectTo);
        }
        break;
      default:
        logout('/');
        break;
    }
  
  }, [user, loading, pathname, router]);

  const value = { user, congregation, loading, logout, updateUser };

  if (loading && !user) {
    return <LoadingScreen />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
