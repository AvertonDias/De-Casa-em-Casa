"use client";
import { useEffect, useState, type ReactNode } from "react";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from "next/navigation";
import { auth, db, messaging, app } from "@/lib/firebase"; // Import app
import { useUser } from '@/contexts/UserContext';
import { useTheme } from 'next-themes';
import { doc, arrayUnion, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

import { Home, Map, Users, Settings, LogOut, Menu, X, Sun, Moon, Trees, Download, Laptop, Share2, Loader, Info, Shield, UserCheck } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";
import withAuth from "@/components/withAuth";
import { usePresence } from "@/hooks/usePresence";
import { EditProfileModal } from "@/components/EditProfileModal"; // Importar o modal de perfil


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


function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const { showInstallButton, canPrompt, deviceInfo, onInstall } = usePWAInstall();
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isShareApiSupported, setIsShareApiSupported] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // Estado para o modal de perfil

  useEffect(() => {
    // Roda apenas no cliente para acessar o 'navigator'
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      setIsShareApiSupported(true);
    }
  }, []);
    
  useEffect(() => {
    if (user && ['Administrador', 'Dirigente'].includes(user.role) && user.congregationId) {
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

  const handleLogout = async () => {
    await logout();
  };

  const getInstructionsMessage = () => {
    if (deviceInfo.isIOS) {
        return "Para instalar, toque no ícone de 'Compartilhar' (um quadrado com uma seta para cima) na barra de menu do Safari e, em seguida, procure pela opção 'Adicionar à Tela de Início'.";
    }
    return "Para instalar o aplicativo, procure no menu do seu navegador (geralmente três pontinhos ou na barra de endereço) pela opção 'Instalar aplicativo' ou 'Adicionar à tela de início'.";
  };
  
  const handleInstallButtonClick = () => {
    if (canPrompt) {
        onInstall();
    } else {
        setIsInstructionsModalOpen(true);
    }
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
    { name: "Início", href: "/dashboard", icon: Home, roles: ['Administrador', 'Dirigente', 'Publicador'] },
    { name: "Territórios", href: "/dashboard/territorios", icon: Map, roles: ['Administrador', 'Dirigente', 'Publicador'] },
    { name: "Rural", href: "/dashboard/rural", icon: Trees, roles: ['Administrador', 'Dirigente', 'Publicador'] },
    { name: "Meus Territórios", href: "/dashboard/meus-territorios", icon: UserCheck, roles: ['Administrador', 'Dirigente', 'Publicador'] },
    { name: "Usuários", href: "/dashboard/usuarios", icon: Users, roles: ['Administrador', 'Dirigente'] },
    { name: "Administração", href: "/dashboard/administracao", icon: Shield, roles: ['Administrador'] },
  ];
  const filteredNavLinks = navLinks.filter(link => user?.role && link.roles.includes(user.role));
  
  return (
    <>
      <div className={cn("fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity", isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={onClose} />
      <aside className={cn(
          "fixed top-0 left-0 h-full w-64 bg-gray-50 dark:bg-[#2A2736] text-gray-800 dark:text-gray-200 p-4 flex flex-col border-r border-gray-200 dark:border-gray-700/50 z-40 transition-transform transform md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
        
        <div className="flex flex-col items-center mb-8 gap-4">
            <div className="w-full flex justify-center items-center">
                <div className="flex-1"></div> {/* Spacer Left */}
                <Image
                    src="/icon-192x192.jpg"
                    alt="Logo"
                    width={80}
                    height={80}
                    className="rounded-lg"
                    priority
                />
                <div className="flex-1 flex justify-end">
                    <div className="hidden md:block">
                        <ThemeSwitcher />
                    </div>
                    <button onClick={onClose} className="md:hidden p-1 rounded-full"><X size={24} /></button>
                </div>
            </div>
            <h1 className="text-xl font-bold">De Casa em Casa</h1>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            {filteredNavLinks.map((link) => {
              const isActive = pathname === link.href || (pathname && link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <li key={link.name}>
                  <Link href={link.href} onClick={onClose} className={cn('flex items-center justify-between text-md p-3 rounded-lg mb-2 transition-colors', isActive ? 'bg-primary text-white font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary/20')}>
                    <div className="flex items-center gap-3">
                      <link.icon className="h-5 w-5" />
                      <span>{link.name}</span>
                    </div>
                    {link.name === "Usuários" && pendingUsersCount > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full animate-pending-pulse"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
         <div className="border-t border-gray-200 dark:border-gray-700/50 pt-4">
            {user && (
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center space-x-3 text-left p-2 rounded-md w-full mb-2 hover:bg-primary/10 transition-colors"
                >
                    <Avatar>
                        <AvatarFallback>
                        {getInitials(user.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-gray-800 dark:text-white">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user.role}
                        </p>
                    </div>
                </button>
            )}
            
            <div className="space-y-1">
                {showInstallButton && (
                    <Button
                        onClick={handleInstallButtonClick}
                        variant="outline"
                        className="w-full justify-center text-green-600 border-green-500/50 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400 dark:border-green-400/50 dark:hover:bg-green-400/10 dark:hover:text-green-400"
                    >
                        <Download className="mr-2" size={20} /> Instalar Aplicativo
                    </Button>
                )}
                
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
                  onClick={handleLogout}
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
          isOpen={isInstructionsModalOpen}
          onClose={() => setIsInstructionsModalOpen(false)}
          onConfirm={() => setIsInstructionsModalOpen(false)}
          title="Como Instalar o Aplicativo"
          message={getInstructionsMessage()}
          confirmText="Entendi"
          showCancelButton={false}
      />
      <EditProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  );
}

function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Ativa o sistema de presença para o usuário logado
  usePresence();

  useEffect(() => {
    const requestPermission = async () => {
      if (user && user.status === 'ativo' && messaging && 'serviceWorker' in navigator) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const swRegistration = await navigator.serviceWorker.ready;
            const token = await getToken(messaging, { 
              vapidKey: 'BD_279ckw7U8KPc5KFJX-8V2UFyvJhnWVqa-XgvJnb91RHf0bjBn21hDHMOKxq1Hb2bEFnOdeclWRnKKsbFfhbk',
              serviceWorkerRegistration: swRegistration
            });
            if (token) {
              console.log('FCM Token:', token);
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                fcmTokens: arrayUnion(token)
              });
            }
          }
        } catch (error) {
          console.error('Erro ao obter permissão de notificação:', error);
        }
      }
    };
    if(!loading) {
      requestPermission();
    }
  }, [user, loading]);

  if (loading || !user) {
    // A tela de carregamento ou redirecionamento é tratada pelo HOC 'withAuth'
    return null;
  }
  
  return (
      <div className="flex h-screen bg-gray-100 dark:bg-[#1E1B29]">
          <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col overflow-hidden">
              <header className="md:hidden bg-gray-50 dark:bg-[#2A2736] p-4 text-gray-800 dark:text-white shadow-md flex justify-between items-center">
                  <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu size={24} /></button>
                  <h1 className="text-lg font-bold">De Casa em Casa</h1>
                  <ThemeSwitcher /> 
              </header>
              <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                  {user.status === 'pendente' && <PendingApprovalBanner />}
                  {children}
              </main>
          </div>
      </div>
  );
}

export default withAuth(DashboardLayout);

    