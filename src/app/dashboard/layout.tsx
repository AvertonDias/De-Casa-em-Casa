"use client";
import { useEffect, useState, useMemo, type ReactNode, useCallback } from "react";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from "next/navigation";
import { auth, db, functions } from "@/lib/firebase"; 
import { useUser } from '@/contexts/UserContext';
import { doc, collection, query, where, onSnapshot, writeBatch, getDoc, Timestamp, setDoc, deleteDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { logEvent } from "@/lib/audit";

import { Home, Map, Users, LogOut, Trees, Download, Share2, Loader, Info, Shield, UserCheck, Bell, Youtube, History, LayoutGrid, MoreHorizontal, FileText, AlertTriangle } from 'lucide-react';
import { cn, getInitials, isTerritoryOverdue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";
import withAuth from "@/components/withAuth";
import { EditProfileModal } from "@/components/EditProfileModal"; 
import { InstallPwaModal } from "@/components/InstallPwaModal"; 
import { ForceLgpdConsentModal } from "@/components/ForceLgpdConsentModal"; 
import { Territory, Notification } from "@/types/types";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SettingsMenu } from "../components/SettingsMenu";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { FontSizeModal } from "@/components/FontSizeModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/Footer";
import { TutorialButton } from "@/components/TutorialButton";
import { TUTORIAL_IDS } from "@/lib/tutorials";
import { CampaignBanner } from "@/components/CampaignBanner";
import { useWebNotifications } from "@/hooks/useWebNotifications";

const AnimatedHamburgerIcon = ({ isOpen, ...props }: { isOpen: boolean } & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <path d="M5 12h14" className={cn("transition-all duration-500", isOpen && "opacity-0")} />
      <path d="M5 6h14" className={cn("transition-all duration-500 origin-center", isOpen && "translate-y-[6px] rotate-45")} />
      <path d="M5 18h14" className={cn("transition-all duration-500 origin-center", isOpen && "-translate-y-[6px] -rotate-45")} />
    </svg>
  );
};

function Sidebar({ 
    isOpen, 
    onClose, 
    pendingUsersCount, 
    unreadNotificationsCount,
    overdueTerritoriesCount,
    showTutorialBadge,
    onEditProfileClick,
    onFontSizeClick,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    pendingUsersCount: number;
    unreadNotificationsCount: number;
    overdueTerritoriesCount: number;
    showTutorialBadge: boolean;
    onEditProfileClick: () => void;
    onFontSizeClick: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const { canPrompt, showInstallPrompt, onInstall } = usePWAInstall();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const { toast } = useToast();

  const handleLogoutConfirm = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleCloseLogoutModal = useCallback(() => {
    setIsLogoutConfirmOpen(false);
  }, []);
  
  const handleShare = async () => {
    const shareData = {
      title: 'De Casa em Casa',
      text: 'Conheça o sistema para gerenciamento de territórios. Na página que abrir, clique em "Abrir App".',
      url: 'https://aplicativos-ton.vercel.app/de-casa-em-casa',
    };
    
    let shared = false;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Erro na API de compartilhamento:", err);
        }
      }
    }
    
    if (!shared && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast({
          title: "Link Copiado!",
          description: "A mensagem e o link de convite foram copiados para a área de transferência.",
        });
        shared = true;
      } catch (err) {
        console.error("Erro ao copiar para a área de transferência:", err);
      }
    }
    
    if (!shared) {
       try {
         window.open(shareData.url, '_blank');
       } catch (err) {
         console.error("Erro ao abrir nova aba:", err);
          toast({
            title: "Erro",
            description: "Não foi possível compartilhar ou copiar o link.",
            variant: "destructive",
          });
       }
    }
  };

  const navLinks = [
    { name: "Início", href: "/dashboard", icon: Home, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios', 'Publicador'] },
    { name: "Territórios", href: "/dashboard/territorios", icon: Map, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios', 'Publicador'] },
    { name: "Rural", href: "/dashboard/rural", icon: Trees, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios', 'Publicador'] },
    { name: "Meus Territórios", href: "/dashboard/meus-territorios", icon: UserCheck, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios', 'Publicador'] },
    { name: "Notificações", href: "/dashboard/notificacoes", icon: Bell, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios', 'Publicador'] },
    { name: "Tutoriais", href: "/dashboard/tutoriais", icon: Youtube, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios', 'Publicador'] },
    { name: "Usuários", href: "/dashboard/usuarios", icon: Users, roles: ['Administrador', 'Dirigente', 'Ajudante de Servo de Territórios', 'Servo de Territórios'] },
    { name: "Mais", href: "/dashboard/mais", icon: LayoutGrid, roles: ['Administrador', 'Dirigente', 'Ajudante de Servo de Territórios', 'Servo de Territórios'] },
  ];
  const filteredNavLinks = navLinks.filter(link => user?.role && link.roles.includes(user.role));
  
  return (
    <>
      <div className={cn("fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity", isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={onClose} />
      <aside className={cn(
          "fixed top-0 left-0 h-full w-64 bg-background text-foreground p-4 flex flex-col border-r border-border/60 z-40 transition-transform transform md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
        
        <div className="flex flex-col items-center mb-8">
            <div className="w-full flex justify-between items-start mb-4">
                <div className="w-8" />
                <Image
                    src="/images/Logo_v3.png"
                    alt="Logo"
                    width={80}
                    height={80}
                    className="rounded-lg"
                    priority
                />
                <div className="flex flex-col items-end gap-2">
                    <div className="hidden md:block">
                        <SettingsMenu 
                          onEditProfileClick={onEditProfileClick} 
                          onFontSizeClick={onFontSizeClick}
                        />
                    </div>
                    <button onClick={onClose} className="md:hidden p-1 rounded-full"><AnimatedHamburgerIcon isOpen={isOpen} /></button>
                </div>
            </div>
            <h1 className="text-xl font-bold">De Casa em Casa</h1>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavLinks.map((link) => {
              const isActive = pathname === link.href || (pathname && link.href !== "/dashboard" && pathname.startsWith(link.href));
              const isTutoriais = link.name === "Tutoriais";
              const hasRedBadge = (link.name === "Usuários" && pendingUsersCount > 0) || 
                                (link.name === "Notificações" && unreadNotificationsCount > 0);
              const hasGreenBadge = isTutoriais && showTutorialBadge;

              return (
                <li key={link.name} className="relative">
                  <Link href={link.href} onClick={onClose} className={cn(
                      'flex items-center text-md p-3 rounded-lg mb-2 transition-colors pr-12', 
                      isActive 
                        ? 'bg-primary text-primary-foreground font-semibold shadow' 
                        : (isTutoriais 
                           ? 'text-green-600 dark:text-green-500 font-bold hover:bg-green-500/10' 
                           : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')
                    )}>
                      <link.icon className={cn("h-5 w-5 mr-3", isTutoriais && !isActive && "text-green-600 dark:text-green-500")} />
                      <span className={cn(isTutoriais && "text-green-600 dark:text-green-500 font-bold")}>{link.name}</span>
                      {hasRedBadge && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm font-sans bg-destructive text-destructive-foreground">
                          {link.name === "Usuários" ? pendingUsersCount : unreadNotificationsCount}
                        </span>
                      )}
                      {hasGreenBadge && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-green-500 rounded-full animate-indicator-pulse"></span>
                      )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
         <div className="border-t border-border pt-4">
            {user && (
                <div 
                  className="flex items-center space-x-3 text-left p-2 rounded-md w-full mb-2"
                >
                    <Avatar className="border-2 border-border">
                        <AvatarImage src={user.photoURL ?? ''} alt={user.name} />
                        <AvatarFallback>
                        {getInitials(user.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.role}
                        </p>
                    </div>
                </div>
            )}
            
            <div className="space-y-1">
                {showInstallPrompt && canPrompt && (
                    <Button onClick={onInstall} variant="outline" className="w-full justify-center text-primary border-primary/50 hover:bg-primary/10 hover:text-primary">
                        <Download className="mr-2" size={20} /> Instalar App
                    </Button>
                )}
                <div className="relative group">
                  <Button onClick={handleShare} variant="outline" className="w-full justify-center text-blue-500 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500 dark:text-blue-400 dark:border-blue-400/50 dark:hover:bg-blue-400/10 dark:hover:text-blue-400">
                      <Share2 className="mr-2" size={20} /> Compartilhar App
                  </Button>
                  <div className="absolute -top-2 -right-1">
                    <TutorialButton 
                      videoId={TUTORIAL_IDS.SHARE_APP} 
                      iconOnly 
                      label="Tutorial de Compartilhamento"
                    />
                  </div>
                </div>

              <FeedbackModal />
              <a href="https://aplicativos-ton.vercel.app/de-casa-em-casa" target="_blank" rel="noopener noreferrer" className="w-full block">
                <Button variant="outline" className="w-full justify-center text-primary border-primary/50 hover:bg-primary/10 hover:text-primary">
                    <Info className="mr-2" size={20} />
                    Sobre
                </Button>
              </a>
              <Button onClick={() => setIsLogoutConfirmOpen(true)} variant="outline" className="w-full justify-center text-red-500 border-red-500/50 hover:bg-red-500/10 hover:text-red-500 dark:text-red-400 dark:border-red-400/50 dark:hover:bg-red-400/10 dark:hover:text-red-400">
                  <LogOut className="mr-2" size={20} />
                  Sair
              </Button>
            </div>
        </div>
      </aside>
       <ConfirmationModal
        isOpen={isLogoutConfirmOpen}
        onClose={handleCloseLogoutModal}
        onConfirm={handleLogoutConfirm}
        title="Confirmar Saída"
        message="Tem certeza que deseja sair? Para entrar novamente, você precisará inserir seu e-mail e senha."
        confirmText="Sim, Sair"
        variant="destructive"
      />
    </>
  );
}

function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const { toast } = useToast();
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFontSizeModalOpen, setIsFontSizeModalOpen] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [unreadNotificationTypes, setUnreadNotificationTypes] = useState<string[]>([]);
  const [overdueTerritoriesCount, setOverdueTerritoriesCount] = useState(0);
  const [myOverdueTerritories, setMyOverdueTerritories] = useState<{ id: string; number: string | number; name: string }[]>([]);
  const [showTutorialBadge, setShowTutorialBadge] = useState(false);

  // Inicializa o serviço de Notificações Push do Navegador/PWA em tempo real
  useWebNotifications();

  useAndroidBack({
    enabled: isSidebarOpen,
    onClose: () => setSidebarOpen(false),
  });

  // Notificações de Usuários Pendentes
  useEffect(() => {
    if (!user?.congregationId || !['Administrador', 'Dirigente'].includes(user.role)) return;
    if (!auth.currentUser || auth.currentUser.isAnonymous) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('congregationId', '==', user.congregationId), where('status', '==', 'pendente'));
    const unsub = onSnapshot(q, (snapshot) => {
        setPendingUsersCount(snapshot.size);
    }, (error) => {
        console.warn("Sem permissão ou erro ao buscar usuários pendentes:", error);
    });
    return () => unsub();
  }, [user]);

  // Notificações de Atividade
  useEffect(() => {
    if (!user?.uid) return;
    if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== user.uid) return;
    const notifRef = collection(db, `users/${user.uid}/notifications`);
    const q = query(notifRef, where('isRead', '==', false), where('type', 'in', ['territory_assigned', 'territory_overdue', 'announcement', 'territory_returned', 'territory_available']));
    const unsub = onSnapshot(q, (snapshot) => {
        setUnreadNotificationsCount(snapshot.size);
        const types = snapshot.docs.map(doc => doc.data().type as string);
        setUnreadNotificationTypes(types);
    }, (error) => {
        console.warn("Sem permissão ou erro ao buscar notificações não lidas:", error);
    });
    return () => unsub();
  }, [user]);

  // Notificações de Territórios Vencidos para Administradores / Servos / Dirigentes (Menu Lateral)
  useEffect(() => {
    if (!user?.congregationId || user.status !== 'ativo') return;
    if (!['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios'].includes(user.role)) {
      setOverdueTerritoriesCount(0);
      return;
    }

    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, where('status', '==', 'designado'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const dueDate = data.assignment?.dueDate;
        if (dueDate && isTerritoryOverdue(dueDate)) {
          count++;
        }
      });
      setOverdueTerritoriesCount(count);
    }, (error) => {
      console.warn("Erro ao carregar territórios vencidos para o menu lateral:", error);
    });

    return () => unsub();
  }, [user]);

  // Sincronização de Notificações de Territórios Atrasados (Individuais)
  useEffect(() => {
    if (!user?.congregationId || !user?.uid || user.status !== 'ativo') return;
    if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== user.uid) return;

    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, where("assignment.uid", "==", user.uid));

    const unsub = onSnapshot(q, async (snapshot) => {
      const territories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      const overdueList: { id: string; number: string | number; name: string }[] = [];
      
      // Itera sobre todos os territórios do usuário
      for (const t of territories) {
        const dueDate = t.assignment?.dueDate;
        if (!dueDate) continue;
        
        const dateObj = dueDate instanceof Timestamp ? dueDate.toDate() : new Date(dueDate as any);
        if (isNaN(dateObj.getTime())) continue; // Evita erros com datas inválidas
        
        const isOverdue = isTerritoryOverdue(dueDate);
        if (isOverdue && t.status === 'designado') {
          overdueList.push({ id: t.id, number: t.number, name: t.name });
        }

        const notifId = `overdue_${t.id}`;
        const notifDocRef = doc(db, `users/${user.uid}/notifications`, notifId);

        if (isOverdue) {
          // Se está atrasado, garante que a notificação exista
          try {
            const notifSnap = await getDoc(notifDocRef);
            if (!notifSnap.exists()) {
              await setDoc(notifDocRef, {
                title: "Território Atrasado!",
                body: `O prazo de devolução do território "${t.number} - ${t.name}" venceu em ${format(dateObj, 'dd/MM/yyyy')}. Por favor, faça a devolução.`,
                link: `/dashboard/meus-territorios`,
                type: 'territory_overdue',
                isRead: false,
                createdAt: Timestamp.now()
              });
            }
          } catch (error) {
            console.warn("Erro ao gerenciar notificação de atraso:", error);
          }
        } else {
          // Se NÃO está atrasado, mas a notificação determinística existia (ex: data foi estendida), removemos
          try {
            const notifSnap = await getDoc(notifDocRef);
            if (notifSnap.exists()) {
              await deleteDoc(notifDocRef);
            }
          } catch (error) {
            console.warn("Erro ao remover notificação de atraso não mais ativo:", error);
          }
        }
      }

      // Tratamento para territórios que o usuário devolveu:
      // Quaisquer notificações do tipo `overdue_...` para territórios que o usuário não possui mais devem ser limpas
      try {
        const userNotifRef = collection(db, `users/${user.uid}/notifications`);
        const overdueNotifsSnap = await getDocs(query(userNotifRef, where('type', '==', 'territory_overdue')));
        
        const currentTerritoryIds = new Set(territories.map(t => t.id));
        
        for (const docSnap of overdueNotifsSnap.docs) {
          const notifId = docSnap.id;
          if (notifId.startsWith('overdue_')) {
            const territoryId = notifId.substring('overdue_'.length);
            // Se o território não pertence mais ao usuário ou a data de vencimento não o coloca como atrasado
            if (!currentTerritoryIds.has(territoryId)) {
              await deleteDoc(doc(db, `users/${user.uid}/notifications`, notifId));
            }
          }
        }
      } catch (error) {
        console.warn("Erro ao limpar notificações órfãs de atraso:", error);
      }

      setMyOverdueTerritories(overdueList);
    }, (error) => {
      console.warn("Erro ao sincronizar notificações de atraso:", error);
    });

    return () => unsub();
  }, [user]);

  // Lógica da bolinha verde dos Tutoriais
  useEffect(() => {
    const viewed = localStorage.getItem('tutorials_viewed_v1');
    if (!viewed) {
      setShowTutorialBadge(true);
    }
  }, []);

  // Limpeza Automática de Usuários Inativos há mais de 365 dias (1 ano) - Apenas para Administrador ao entrar no painel
  useEffect(() => {
    if (!user?.congregationId || user.role !== 'Administrador' || user.status !== 'ativo') return;
    if (!auth.currentUser || auth.currentUser.isAnonymous) return;

    const sessionKey = `inactive_365_cleanup_${user.uid}_${user.congregationId}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return; // Já executou nesta sessão
    }

    const checkAndCleanInactiveUsers = async () => {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, 'true');
        }

        const usersRef = collection(db, 'users');
        const qUsers = query(usersRef, where('congregationId', '==', user.congregationId));
        const snapshot = await getDocs(qUsers);

        const cutoffDate = subDays(new Date(), 365);
        const usersToDelete: { uid: string; name: string; email?: string }[] = [];

        snapshot.forEach((docSnap) => {
          const uData = docSnap.data();
          const uUid = docSnap.id;

          // Nunca excluir o próprio admin
          if (uUid === user.uid) return;

          // Obter data da última atividade
          let lastSeenDate: Date | null = null;
          if (uData.lastSeen && typeof uData.lastSeen.toDate === 'function') {
            lastSeenDate = uData.lastSeen.toDate();
          } else if (uData.lastSeen?.seconds) {
            lastSeenDate = new Date(uData.lastSeen.seconds * 1000);
          } else if (typeof uData.lastSeen === 'string') {
            lastSeenDate = new Date(uData.lastSeen);
          } else if (uData.createdAt?.toDate) {
            lastSeenDate = uData.createdAt.toDate();
          } else if (uData.createdAt?.seconds) {
            lastSeenDate = new Date(uData.createdAt.seconds * 1000);
          }

          // Se tiver última atividade e for anterior a 365 dias atrás, ou se for inativo e não tiver registro recente
          const isOver365Days = lastSeenDate ? lastSeenDate < cutoffDate : (uData.status === 'inativo');

          if (isOver365Days) {
            usersToDelete.push({
              uid: uUid,
              name: uData.name || 'Sem nome',
              email: uData.email,
            });
          }
        });

        if (usersToDelete.length > 0) {
          const deletedNames: string[] = [];

          for (const u of usersToDelete) {
            try {
              // Tenta via Cloud Function primeiro se disponível
              if (functions) {
                try {
                  const deleteUserAccount = httpsCallable(functions, 'deleteUserAccountV2');
                  await deleteUserAccount({ userIdToDelete: u.uid });
                } catch (fnErr) {
                  console.warn("Exclusão por Cloud Function falhou, apagando via Firestore:", fnErr);
                }
              }

              // Apaga documento do Firestore
              await deleteDoc(doc(db, 'users', u.uid));

              if (u.email) {
                const emailClean = u.email.toLowerCase().trim();
                await deleteDoc(doc(db, 'loginAttempts', emailClean)).catch(() => {});
              }

              await logEvent(
                user.congregationId || "",
                user.uid,
                user.name,
                'AUTO_CLEANUP_INACTIVE_USERS',
                `Exclusão automática de usuário inativo há mais de 1 ano (365 dias): ${u.name} (${u.email || u.uid})`,
                { deletedUserId: u.uid, reason: 'inactive_over_365_days' }
              );

              deletedNames.push(u.name);
            } catch (err) {
              console.error(`Erro ao apagar usuário inativo ${u.name}:`, err);
            }
          }

          if (deletedNames.length > 0) {
            const notifMsg = `${deletedNames.length} usuário(s) inativo(s) há mais de 1 ano (365 dias) foram excluídos automaticamente: ${deletedNames.join(', ')}.`;
            
            toast({
              title: "🧹 Limpeza Automática de Usuários",
              description: notifMsg,
              duration: 12000,
            });

            // Registrar também na central de notificações do Administrador
            try {
              const userNotifRef = collection(db, `users/${user.uid}/notifications`);
              await addDoc(userNotifRef, {
                title: "🧹 Limpeza Automática de Usuários",
                body: notifMsg,
                type: "announcement",
                link: "/dashboard/usuarios",
                isRead: false,
                createdAt: serverTimestamp(),
              });
            } catch (notifErr) {
              console.warn("Erro ao salvar notificação da limpeza automática:", notifErr);
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao verificar/limpar usuários inativos +365 dias:", err);
      }
    };

    checkAndCleanInactiveUsers();
  }, [user, toast]);

  // Limpeza Automática Silenciosa de Notificações Antigas do Banco de Dados
  useEffect(() => {
    if (!user?.uid || !auth.currentUser || auth.currentUser.isAnonymous) return;

    const sessionKey = `clean_old_notifs_v3_${user.uid}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return;
    }

    const purgeOldNotifications = async () => {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, 'true');
        }

        const cutoffDate = new Date('2026-07-24T00:00:00Z');

        // 1. Apaga notificações antigas do próprio usuário
        const userNotifRef = collection(db, `users/${user.uid}/notifications`);
        const userNotifSnap = await getDocs(userNotifRef);

        let batch = writeBatch(db);
        let batchCount = 0;

        userNotifSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          if (!createdAt || createdAt < cutoffDate) {
            batch.delete(docSnap.ref);
            batchCount++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
        }

        // 2. Se for Administrador, varre e limpa as notificações antigas dos demais membros da congregação
        if (user.role === 'Administrador' && user.congregationId) {
          const usersQuery = query(collection(db, 'users'), where('congregationId', '==', user.congregationId));
          const usersSnap = await getDocs(usersQuery);

          for (const uDoc of usersSnap.docs) {
            if (uDoc.id === user.uid) continue;

            const memberNotifRef = collection(db, `users/${uDoc.id}/notifications`);
            const memberNotifSnap = await getDocs(memberNotifRef);

            let mBatch = writeBatch(db);
            let mCount = 0;

            for (const mNotifDoc of memberNotifSnap.docs) {
              const data = mNotifDoc.data();
              const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
              if (!createdAt || createdAt < cutoffDate) {
                mBatch.delete(mNotifDoc.ref);
                mCount++;

                if (mCount >= 400) {
                  await mBatch.commit();
                  mBatch = writeBatch(db);
                  mCount = 0;
                }
              }
            }

            if (mCount > 0) {
              await mBatch.commit();
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao executar limpeza automática de notificações antigas:", err);
      }
    };

    purgeOldNotifications();
  }, [user]);

  useEffect(() => {
    if (pathname === '/dashboard/tutoriais') {
      localStorage.setItem('tutorials_viewed_v1', 'true');
      setShowTutorialBadge(false);
    }
  }, [pathname]);

  // Cálculo dinâmico das cores ativas de notificação
  const activeColors = useMemo(() => {
    const colors: string[] = [];

    // 1. Territórios Atrasados do próprio usuário (Alerta direto) -> Vermelho
    if (myOverdueTerritories.length > 0) {
      colors.push('#ef4444');
    }

    // 2. Notificações não lidas da Central (mapeadas rigorosamente pela cor do tipo)
    if (unreadNotificationsCount > 0) {
      if (unreadNotificationTypes.length > 0) {
        unreadNotificationTypes.forEach(type => {
          if (type === 'territory_overdue') {
            colors.push('#ef4444'); // Vermelho (Atraso)
          } else if (type === 'territory_assigned' || type === 'announcement') {
            colors.push('#3b82f6'); // Azul (Designado / Comunicado)
          } else if (type === 'territory_returned' || type === 'territory_available') {
            colors.push('#10b981'); // Verde (Devolvido / Disponível)
          } else if (type === 'user_pending') {
            colors.push('#f59e0b'); // Amarelo/Amber (Pendente)
          } else {
            colors.push('#3b82f6'); // Azul padrão
          }
        });
      } else {
        colors.push('#ef4444');
      }
    }

    // 3. Usuários Pendentes de Aprovação -> Amarelo/Amber (#f59e0b)
    if (pendingUsersCount > 0) {
      colors.push('#f59e0b');
    }

    // 4. Badge de Tutoriais / Novidades -> Verde (#10b981)
    if (showTutorialBadge) {
      colors.push('#10b981');
    }

    // Retorna cores únicas ativas no momento
    return Array.from(new Set(colors));
  }, [
    myOverdueTerritories.length,
    unreadNotificationsCount,
    unreadNotificationTypes,
    pendingUsersCount,
    showTutorialBadge
  ]);

  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  useEffect(() => {
    if (activeColors.length <= 1) {
      setCurrentColorIndex(prev => (prev === 0 ? 0 : 0));
      return;
    }
    const interval = setInterval(() => {
      setCurrentColorIndex(prev => (prev + 1) % activeColors.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [activeColors.length]);

  if (loading || !user) {
    return null;
  }

  const currentColor = activeColors[currentColorIndex % activeColors.length] || '#ef4444';

  return (
      <div className="flex h-screen bg-background overflow-hidden">
          <InstallPwaModal />
          
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            pendingUsersCount={pendingUsersCount}
            unreadNotificationsCount={unreadNotificationsCount}
            overdueTerritoriesCount={overdueTerritoriesCount}
            showTutorialBadge={showTutorialBadge}
            onEditProfileClick={() => setIsProfileModalOpen(true)}
            onFontSizeClick={() => setIsFontSizeModalOpen(true)}
          />

          <div className="flex-1 flex flex-col w-full min-w-0">
              <CampaignBanner />
              <header className="md:hidden bg-background p-4 text-foreground shadow-md flex justify-between items-center border-b border-border sticky top-0 z-20">
                  <div className="relative">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} aria-label="Abrir menu">
                      <AnimatedHamburgerIcon isOpen={isSidebarOpen} />
                    </button>
                    {activeColors.length > 0 && (
                      <span
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full transition-all duration-700 animate-pulse"
                        style={{
                          backgroundColor: currentColor,
                          boxShadow: `0 0 8px 2px ${currentColor}aa`
                        }}
                      />
                    )}
                  </div>
                  <h1 className="text-lg font-bold">De Casa em Casa</h1>
                  <SettingsMenu 
                    onEditProfileClick={() => setIsProfileModalOpen(true)} 
                    onFontSizeClick={() => setIsFontSizeModalOpen(true)}
                  /> 
              </header>
              
              <main className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex-1">
                  {user.status === 'pendente' && (
                    <div className="sticky top-0 z-10 bg-background p-4 md:p-8 pb-0">
                      <PendingApprovalBanner />
                    </div>
                  )}

                  {myOverdueTerritories.length > 0 && (
                    <div className="px-4 pt-4 md:px-8 md:pt-6">
                      <div id="meus-territorios-atrasados-alert" className="p-4 bg-destructive/10 text-destructive-foreground border border-destructive/20 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="text-destructive mt-0.5 shrink-0" size={22} />
                          <div>
                            <p className="font-bold text-base text-foreground">Atenção: Território Atrasado!</p>
                            <p className="text-sm text-muted-foreground mt-0.5 font-sans">
                              Você possui {myOverdueTerritories.length === 1 ? 'um território designado' : `${myOverdueTerritories.length} territórios designados`} cuja data de devolução já venceu.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {myOverdueTerritories.map(t => (
                                <span key={t.id} className="inline-flex items-center px-2 py-1 rounded bg-destructive/20 text-xs font-semibold text-foreground border border-destructive/30 font-sans">
                                  Nº {t.number} - {t.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Link href="/dashboard/meus-territorios" className="shrink-0">
                          <Button variant="destructive" size="sm" className="font-bold w-full md:w-auto font-sans">
                            Ver Meus Territórios
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4 md:p-8">
                    {children}
                  </div>
                </div>
                <Footer />
              </main>
          </div>
          
          <EditProfileModal isOpen={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
          <FontSizeModal isOpen={isFontSizeModalOpen} onOpenChange={setIsFontSizeModalOpen} />
          <ForceLgpdConsentModal />
      </div>
  );
}

export default withAuth(DashboardLayout);