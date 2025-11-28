
"use client";
import { useEffect, useState, type ReactNode } from "react";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from "next/navigation";
import { auth, db, app } from "@/lib/firebase"; // Import app
import { useUser } from '@/contexts/UserContext';
import { useTheme } from 'next-themes';
import { doc, updateDoc, collection, query, where, onSnapshot, writeBatch, getDoc, setDoc, orderBy } from 'firebase/firestore';


import { Home, Map, Users, LogOut, Menu, X, Sun, Moon, Trees, Download, Laptop, Share2, Loader, Info, Shield, UserCheck, Bell } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";
import withAuth from "@/components/withAuth";
import { usePresence } from "@/hooks/usePresence";
import { EditProfileModal } from "@/components/EditProfileModal"; // Importar o modal de perfil
import { InstallPwaModal } from "@/components/InstallPwaModal"; // IMPORTAR O NOVO MODAL
import { Territory, Notification } from "@/types/types";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";


// Componente para trocar o tema (agora mais robusto)
function ThemeSwitcher() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alterar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Escuro</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop className="mr-2 h-4 w-4" />
          <span>Padrão do dispositivo</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
      <path
        d="M5 12h14"
        className={cn(
          "transition-all duration-500",
          isOpen && "opacity-0"
        )}
      />
       <path
        d="M5 6h14"
        className={cn(
          "transition-all duration-500 origin-center",
          isOpen && "translate-y-[6px] rotate-45"
        )}
      />
      <path
        d="M5 18h14"
        className={cn(
          "transition-all duration-500 origin-center",
          isOpen && "-translate-y-[6px] -rotate-45"
        )}
      />
    </svg>
  );
};



function Sidebar({ 
    isOpen, 
    onClose, 
    pendingUsersCount, 
    unreadNotificationsCount 
}: { 
    isOpen: boolean; 
    onClose: () => void;
    pendingUsersCount: number;
    unreadNotificationsCount: number;
}) {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [isShareApiSupported, setIsShareApiSupported] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      setIsShareApiSupported(true);
    }
  }, []);
    
  const handleLogout = async () => {
    await logout();
  };
  
  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'De Casa em Casa',
                text: 'Conheça o aplicativo para gerenciamento de territórios!',
                url: window.location.origin
            });
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
        }
    }
  };

  const navLinks = [
    { name: "Início", href: "/dashboard", icon: Home, roles: ['Administrador', 'Dirigente', 'Servo de Territórios', 'Publicador'] },
    { name: "Territórios", href: "/dashboard/territorios", icon: Map, roles: ['Administrador', 'Dirigente', 'Publicador', 'Servo de Territórios'] },
    { name: "Rural", href: "/dashboard/rural", icon: Trees, roles: ['Administrador', 'Dirigente', 'Publicador', 'Servo de Territórios'] },
    { name: "Meus Territórios", href: "/dashboard/meus-territorios", icon: UserCheck, roles: ['Administrador', 'Dirigente', 'Publicador', 'Servo de Territórios'] },
    { name: "Notificações", href: "/dashboard/notificacoes", icon: Bell, roles: ['Administrador', 'Dirigente', 'Publicador', 'Servo de Territórios'] },
    { name: "Usuários", href: "/dashboard/usuarios", icon: Users, roles: ['Administrador', 'Dirigente'] },
    { name: "Administração", href: "/dashboard/administracao", icon: Shield, roles: ['Administrador', 'Dirigente', 'Servo de Territórios'] },
  ];
  const filteredNavLinks = navLinks.filter(link => user?.role && link.roles.includes(user.role));
  
  return (
    <>
      <div className={cn("fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity", isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={onClose} />
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
                        <ThemeSwitcher />
                    </div>
                    <button onClick={onClose} className="md:hidden p-1 rounded-full"><AnimatedHamburgerIcon isOpen={isOpen} /></button>
                </div>
            </div>
            <h1 className="text-xl font-bold">De Casa em Casa</h1>
        </div>


        <nav className="flex-1">
          <ul className="space-y-1">
            {filteredNavLinks.map((link) => {
              const isActive = pathname === link.href || (pathname && link.href !== "/dashboard" && pathname.startsWith(link.href));
              const hasUnread = (link.name === "Usuários" && pendingUsersCount > 0) || 
                                (link.name === "Notificações" && unreadNotificationsCount > 0);
              return (
                <li key={link.name} className="relative">
                  <Link href={link.href} onClick={onClose} className={cn(
                      'flex items-center text-md p-3 rounded-lg mb-2 transition-colors', 
                      isActive 
                        ? 'bg-primary text-primary-foreground font-semibold shadow' 
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}>
                      <link.icon className="h-5 w-5 mr-3" />
                      <span>{link.name}</span>
                      {hasUnread && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-destructive rounded-full animate-indicator-pulse"></span>
                      )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
         <div className="border-t border-border pt-4">
            {user && (
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center space-x-3 text-left p-2 rounded-md w-full mb-2 hover:bg-muted transition-colors"
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
                </button>
            )}
            
            <div className="space-y-1">
                {isShareApiSupported && (
                    <Button
                        onClick={handleShare}
                        variant="outline"
                        className="w-full justify-center text-blue-500 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500 dark:text-blue-400 dark:border-blue-400/50 dark:hover:bg-blue-400/10 dark:hover:text-blue-400"
                    >
                        <Share2 className="mr-2" size={20} /> Compartilhar App
                    </Button>
                )}
              <FeedbackModal />
              <Link href="/sobre" className="w-full block">
                <Button variant="outline" className="w-full justify-center text-primary border-primary/50 hover:bg-primary/10 hover:text-primary">
                    <Info className="mr-2" size={20} />
                    Sobre o App
                </Button>
              </Link>
              <Button
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  variant="outline"
                  className="w-full justify-center text-red-500 border-red-500/50 hover:bg-red-500/10 hover:text-red-500 dark:text-red-400 dark:border-red-400/50 dark:hover:bg-red-400/10 dark:hover:text-red-400"
              >
                  <LogOut className="mr-2" size={20} />
                  Sair
              </Button>
            </div>
        </div>
      </aside>
       <ConfirmationModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Confirmar Saída"
        message="Tem certeza que deseja sair? Para entrar novamente, você precisará inserir seu e-mail e senha."
        confirmText="Sim, Sair"
        variant="destructive"
      />
      <EditProfileModal isOpen={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
    </>
  );
}

function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  usePresence();

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('Permissão para notificações concedida.');
            // Aqui você pode inicializar o FCM para obter o token do dispositivo
          } else {
            console.log('Permissão para notificações não concedida.');
          }
        } catch (error) {
          console.error('Erro ao solicitar permissão para notificações:', error);
        }
      }
    };
    
    // Pede permissão assim que o layout é montado, se o usuário estiver logado
    if (user && Notification.permission === 'default') {
      requestNotificationPermission();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    if (['Administrador', 'Dirigente'].includes(user.role) && user.congregationId) {
      const q = query(
        collection(db, 'users'),
        where('congregationId', '==', user.congregationId),
        where('status', '==', 'pendente')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingUsersCount(snapshot.size);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    let listeners: (() => void)[] = [];
  
    if (user?.uid && user.congregationId) {
        // Listener para contar notificações não lidas
        const qNotifications = query(
          collection(db, 'users', user.uid, 'notifications'),
          where('isRead', '==', false)
        );
        const unsubCount = onSnapshot(qNotifications, (snapshot) => {
            const unreadNotifications = snapshot.docs
                .map(doc => doc.data() as Notification)
                .filter(n => n.type !== 'user_pending');
            setUnreadNotificationsCount(unreadNotifications.length);
        });
        listeners.push(unsubCount);
      
        const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
        const userNotificationsRef = collection(db, 'users', user.uid, 'notifications');
      
        // Listener para criar notificações de territórios designados
        const qAssigned = query(territoriesRef, where("assignment.uid", "==", user.uid));
        const unsubAssigned = onSnapshot(qAssigned, async (snapshot) => {
          const batch = writeBatch(db);
          for (const docSnap of snapshot.docs) {
            const territory = { id: docSnap.id, ...docSnap.data() } as Territory;
            if (territory.assignment?.assignedAt) {
              const assignmentTimestamp = territory.assignment.assignedAt.toMillis();
              const notificationId = `assigned_${territory.id}_${assignmentTimestamp}`;
              const notificationRef = doc(userNotificationsRef, notificationId);
              
              const notificationDoc = await getDoc(notificationRef);
              if (!notificationDoc.exists()) {
                const territoryPath = territory.type === 'rural' ? `/dashboard/rural/${territory.id}` : `/dashboard/territorios/${territory.id}`;
                batch.set(notificationRef, {
                  title: "Você recebeu um novo território!",
                  body: `O território "${territory.name}" foi designado para você.`,
                  link: territoryPath,
                  type: "territory_assigned",
                  isRead: false,
                  createdAt: Timestamp.now(),
                });
              }
            }
          }
          await batch.commit();
        });
        listeners.push(unsubAssigned);
      
        // Listener para criar notificações de territórios atrasados
        const qOverdue = query(territoriesRef, 
          where("assignment.uid", "==", user.uid),
          where("assignment.dueDate", "<", Timestamp.now())
        );
        const unsubOverdue = onSnapshot(qOverdue, async (snapshot) => {
          const batch = writeBatch(db);
          const todayStr = format(new Date(), 'yyyy-MM-dd');
      
          for (const docSnap of snapshot.docs) {
            const territory = { id: docSnap.id, ...docSnap.data() } as Territory;
            const notificationId = `overdue_${territory.id}_${todayStr}`;
            const notificationRef = doc(userNotificationsRef, notificationId);
            
            const notificationDoc = await getDoc(notificationRef);
      
            if (!notificationDoc.exists()) {
              batch.set(notificationRef, {
                title: "Território Atrasado",
                body: `O território "${territory.name}" está com a devolução atrasada.`,
                link: `/dashboard/meus-territorios`,
                type: "territory_overdue",
                isRead: false,
                createdAt: Timestamp.now(),
              });
            }
          }
          await batch.commit();
        });
        listeners.push(unsubOverdue);
    }
  
    // Função de limpeza
    return () => {
      listeners.forEach(unsub => unsub());
    };
  }, [user]);
  
  if (loading || !user) {
    return null;
  }
  
  const hasUnreadItems = pendingUsersCount > 0 || unreadNotificationsCount > 0;

  return (
      <div className="flex h-screen bg-background">
          <InstallPwaModal />
          
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            pendingUsersCount={pendingUsersCount}
            unreadNotificationsCount={unreadNotificationsCount}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
              <header className="md:hidden bg-background p-4 text-foreground shadow-md flex justify-between items-center border-b border-border">
                  <div className="relative">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} aria-label="Abrir menu">
                      <AnimatedHamburgerIcon isOpen={isSidebarOpen} />
                    </button>
                    {hasUnreadItems && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full animate-indicator-pulse"></span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold">De Casa em Casa</h1>
                  <ThemeSwitcher /> 
              </header>
              <div className="sticky top-0 z-10 bg-background">
                <div className="p-4 md:p-8 pb-0">
                    {user.status === 'pendente' && <PendingApprovalBanner />}
                </div>
              </div>
              <main className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-8 pt-4">
                  {children}
                </div>
              </main>
          </div>
          <EditProfileModal isOpen={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
      </div>
  );
}

export default withAuth(DashboardLayout);
