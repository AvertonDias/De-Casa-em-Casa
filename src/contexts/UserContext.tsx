
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDoc, setDoc, collection, query, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, Congregation } from '@/types/types';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { subMonths } from 'date-fns';
import { LoadingScreen } from '@/components/LoadingScreen';


interface UserContextType {
  user: AppUser | null;
  congregation: Congregation | null;
  loading: boolean;
  logout: (redirectPath?: string) => Promise<void>;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
  initialSyncing: boolean; // Novo estado para o sync inicial
}

export const UserContext = createContext<UserContextType | undefined>(undefined);
export const useUser = () => useContext(UserContext)!;

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [congregation, setCongregation] = useState<Congregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialSyncing, setInitialSyncing] = useState(false); // Estado para o sync
  const router = useRouter();
  const pathname = usePathname();
  
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

  // Efeito para pré-carregar todos os dados da congregação
  useEffect(() => {
    const fetchAllData = async () => {
      if (!user?.congregationId || sessionStorage.getItem(`initialDataFetched_${user.congregationId}`)) {
        return;
      }
      
      console.log("Iniciando pré-carregamento de dados para uso offline...");
      setInitialSyncing(true);

      try {
        const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
        const territoriesSnapshot = await getDocs(territoriesRef);

        for (const territoryDoc of territoriesSnapshot.docs) {
          // Para cada território, busca suas subcoleções
          const quadrasRef = collection(territoryDoc.ref, 'quadras');
          const quadrasSnapshot = await getDocs(quadrasRef);

          for (const quadraDoc of quadrasSnapshot.docs) {
            // Para cada quadra, busca as casas
            const casasRef = collection(quadraDoc.ref, 'casas');
            await getDocs(casasRef); // A simples leitura armazena em cache
          }
        }
        
        sessionStorage.setItem(`initialDataFetched_${user.congregationId}`, 'true');
        console.log("Pré-carregamento de dados offline concluído com sucesso.");

      } catch (error) {
        console.error("Erro durante o pré-carregamento de dados offline:", error);
      } finally {
        setInitialSyncing(false);
      }
    };

    if (user && congregation) {
      // Inicia o fetch em segundo plano sem bloquear a UI
      fetchAllData();
    }
  }, [user, congregation]);


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
          const pendingDataStr = sessionStorage.getItem('pendingUserData');
          if (pendingDataStr) {
            try {
              const pendingData = JSON.parse(pendingDataStr);
              await setDoc(userRef, {
                email: firebaseUser.email, name: firebaseUser.displayName, photoURL: firebaseUser.photoURL,
                ...pendingData,
                createdAt: serverTimestamp(), lastSeen: serverTimestamp()
              });
              sessionStorage.removeItem('pendingUserData');
            } catch (error) { logout('/'); }
          } else { logout('/'); }
          return;
        }

        const rawData = userDoc.data();
        let appStatus = rawData?.status;
        const oneMonthAgo = subMonths(new Date(), 1);
        if (appStatus === 'ativo' && rawData?.lastSeen && rawData.lastSeen.toDate() < oneMonthAgo) {
          appStatus = 'inativo';
        }
        
        const appUser = { 
          uid: firebaseUser.uid, ...rawData, status: appStatus,
          name: rawData?.name || firebaseUser.displayName, email: rawData?.email || firebaseUser.email,
        } as AppUser;

        if (appUser.status === 'bloqueado' || appUser.status === 'rejeitado') {
            logout('/');
            return;
        }

        setUser(appUser);
        
        if (listenersRef.current.congregation) {
            listenersRef.current.congregation();
            delete listenersRef.current.congregation;
            setCongregation(null);
        }
        
        if (appUser.congregationId) {
          const congRef = doc(db, 'congregations', appUser.congregationId);
          listenersRef.current.congregation = onSnapshot(congRef, (congDoc) => {
            if (congDoc.exists()) {
              const congData = { id: congDoc.id, ...congDoc.data() } as Congregation;
              setCongregation(congData);
              setUser(prevUser => prevUser ? {...prevUser, congregationName: congData.name} : null);
            } else {
              setCongregation(null);
            }
            setLoading(false); 
          }, (error) => {
            console.error("Erro no listener de congregação:", error);
            setCongregation(null);
            setLoading(false);
          });
        } else {
            setCongregation(null);
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
          const isAdminOrManager = user.role === 'Administrador' || user.role === 'Dirigente';
          const redirectTo = isAdminOrManager ? '/dashboard' : '/dashboard/meus-territorios';
          router.replace(redirectTo);
        }
        break;
      default:
        logout('/');
        break;
    }
  
  }, [user, loading, pathname, router, logout]);

  const value = { user, congregation, loading, logout, updateUser, initialSyncing };

  // Mostra a tela de loading apenas se os dados essenciais ainda não foram carregados.
  // A sincronização em segundo plano não deve mais bloquear a UI.
  if (loading && !initialSyncing) {
    return <LoadingScreen isSyncing={false} />;
  }

  // Se a sincronização inicial estiver acontecendo, mostramos uma tela específica
  if (initialSyncing) {
      return <LoadingScreen isSyncing={true} />;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
