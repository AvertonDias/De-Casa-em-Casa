"use client";
import { useEffect, useState, type ReactNode, useCallback } from "react";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase"; 
import { useUser } from '@/contexts/UserContext';
import { doc, collection, query, where, onSnapshot, writeBatch, getDoc, Timestamp } from 'firebase/firestore';

import { Home, Map, Users, LogOut, Trees, Download, Share2, Loader, Info, Shield, UserCheck, Bell } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";
import withAuth from "@/components/withAuth";
import { EditProfileModal } from "@/components/EditProfileModal"; 
import { InstallPwaModal } from "@/components/InstallPwaModal"; 
import { Territory, Notification } from "@/types/types";
import { format } from "date-fns";
import { SettingsMenu } from "../components/SettingsMenu";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { FontSizeModal } from "@/components/FontSizeModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

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
    onEditProfileClick,
    onFontSizeClick,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    pendingUsersCount: number;
    unreadNotificationsCount: number;
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
    { name: "Usuários", href: "/dashboard/usuarios", icon: Users, roles: ['Administrador', 'Dirigente', 'Ajudante de Servo de Territórios', 'Servo de Territórios'] },
    { name: "Administração", href: "/dashboard/administracao", icon: Shield, roles: ['Administrador', 'Dirigente', 'Ajudante de Servo de Territórios', 'Servo de Territórios'] },
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
                <Button onClick={handleShare} variant="outline" className="w-full justify-center text-blue-500 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500 dark:text-blue-400 dark:border-blue-400/50 dark:hover:bg-blue-400/10 dark:hover:text-blue-400">
                    <Share2 className="mr-2" size={20} /> Compartilhar App
                </Button>
              <FeedbackModal />
              <Link href="/sobre" className="w-full block">
                <Button variant="outline" className="w-full justify-center text-primary border-primary/50 hover:bg-primary/10 hover:text-primary">
                    <Info className="mr-2" size={20} />
                    Sobre
                </Button>
              </Link>
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
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFontSizeModalOpen, setIsFontSizeModalOpen] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useAndroidBack({
    enabled: isSidebarOpen,
    onClose: () => setSidebarOpen(false),
  });

  useEffect(() => {
    if (!user?.congregationId || !['Administrador', 'Dirigente'].includes(user.role)) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('congregationId', '==', user.congregationId), where('status', '==', 'pendente'));
    const unsub = onSnapshot(q, (snapshot) => {
        setPendingUsersCount(snapshot.size);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;
    const notifRef = collection(db, `users/${user.uid}/notifications`);
    const q = query(notifRef, where('isRead', '==', false), where('type', 'in', ['territory_assigned', 'territory_overdue', 'announcement', 'territory_returned', 'territory_available']));
    const unsub = onSnapshot(q, (snapshot) => {
        setUnreadNotificationsCount(snapshot.size);
    });
    return () => unsub();
  }, [user]);

  if (loading || !user) {
    return null;
  }
  
  const hasUnreadItems = pendingUsersCount > 0 || unreadNotificationsCount > 0;

  return (
      <div className="flex h-screen bg-background overflow-hidden">
          <InstallPwaModal />
          
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            pendingUsersCount={pendingUsersCount}
            unreadNotificationsCount={unreadNotificationsCount}
            onEditProfileClick={() => setIsProfileModalOpen(true)}
            onFontSizeClick={() => setIsFontSizeModalOpen(true)}
          />

          <div className="flex-1 flex flex-col w-full min-w-0">
              <header className="md:hidden bg-background p-4 text-foreground shadow-md flex justify-between items-center border-b border-border sticky top-0 z-20">
                  <div className="relative">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} aria-label="Abrir menu">
                      <AnimatedHamburgerIcon isOpen={isSidebarOpen} />
                    </button>
                    {hasUnreadItems && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full animate-indicator-pulse"></span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold">De Casa em Casa</h1>
                  <SettingsMenu 
                    onEditProfileClick={() => setIsProfileModalOpen(true)} 
                    onFontSizeClick={() => setIsFontSizeModalOpen(true)}
                  /> 
              </header>
              
              <main className="flex-1 overflow-y-auto">
                {user.status === 'pendente' && (
                  <div className="sticky top-0 z-10 bg-background p-4 md:p-8 pb-0">
                    <PendingApprovalBanner />
                  </div>
                )}
                
                <div className="p-4 md:p-8">
                  {children}
                </div>
              </main>
          </div>
          
          <EditProfileModal isOpen={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
          <FontSizeModal isOpen={isFontSizeModalOpen} onOpenChange={setIsFontSizeModalOpen} />
      </div>
  );
}

export default withAuth(DashboardLayout);
