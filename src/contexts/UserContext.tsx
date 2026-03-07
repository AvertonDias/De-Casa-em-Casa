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
    await signOut(auth).catch(e => console.error("Falha no signOut do Auth:", e));
    
    setUser(null);
    setCongregation(null);
    unsubscribeAll();

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
            listenersRef.current.congregation = onSnapshot(congRef, 
              (congDoc) => {
                if (congDoc.exists()) {
                  const congData = { id: congDoc.id, ...congDoc.data() } as Congregation;
                  setCongregation(congData);
                  setUser({ ...appUser, congregationName: congData.name });
                } else {
                  setCongregation(null);
                  setUser(appUser);
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

            const territoryCollectionPath = `congregations/${appUser.congregationId}/territories`;
            const assignedTerritoriesQuery = query(
                collection(db, territoryCollectionPath),
                where("assignment.uid", "==", appUser.uid)
            );
            
            listenersRef.current.overdueListener = onSnapshot(assignedTerritoriesQuery, 
              (snapshot) => {
                snapshot.docs.forEach(async (territoryDoc) => {
                    const territory = { id: territoryDoc.id, ...territoryDoc.data() } as Territory;
                    const isOverdue = territory.assignment && territory.assignment.dueDate.toDate() < new Date();

                    if (isOverdue) {
                        const notificationsRef = collection(db, `users/${appUser.uid}/notifications`);
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
                                        path: `users/${appUser.uid}/notifications`,
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
                if (error.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: territoryCollectionPath,
                        operation: 'list',
                    } satisfies SecurityRuleContext);
                    errorEmitter.emit('permission-error', permissionError);
                }
              }
            );

          } else {
              setCongregation(null);
              setUser(appUser);
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
  
  }, [user, loading, pathname, router, logout]);

  const value = { user, congregation, loading, logout, updateUser };

  if (loading && !user) {
    return <LoadingScreen />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
