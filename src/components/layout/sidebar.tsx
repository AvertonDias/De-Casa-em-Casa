"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from 'next/image';
import {
  Home,
  Map,
  Users,
  Settings,
  LogOut,
  X,
  Laptop,
  Sun,
  Moon,
  Trees,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/contexts/UserContext";
import { auth, db } from "@/lib/firebase";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getInitials } from "@/lib/utils";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { ConfirmationModal } from '@/components/ConfirmationModal';

const navItems = [
  { name: "Início", href: "/dashboard", icon: Home, roles: ['Administrador', 'Dirigente', 'Publicador'] },
  { name: "Territórios", href: "/dashboard/territorios", icon: Map, roles: ['Administrador', 'Dirigente', 'Publicador'] },
  { name: "Rural", href: "/dashboard/rural", icon: Trees, roles: ['Administrador', 'Dirigente', 'Publicador'] },
  { name: "Usuários", href: "/dashboard/usuarios", icon: Users, roles: ['Administrador', 'Dirigente'] },
  { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings, roles: ['Administrador', 'Dirigente', 'Publicador'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function ThemeSwitcher() {
  const { setTheme } = useTheme();

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
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const router = useRouter();
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const { showInstallButton, canPrompt, deviceInfo, onInstall } = usePWAInstall();
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);

  const getInstructionsMessage = () => {
      if (deviceInfo.isIOS) {
          return "Para instalar, toque no ícone de 'Compartilhar' (um quadrado com uma seta para cima) na barra de menu do Safari e, em seguida, procure pela opção 'Adicionar à Tela de Início'.";
      }
      return "Para instalar o aplicativo, procure no menu do seu navegador (geralmente três pontinhos ou na barra de endereço) pela opção 'Instalar aplicativo' ou 'Adicionar à tela de início'.";
  };

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
    try {
      await auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };
  
  const handleInstallButtonClick = () => {
      if (canPrompt) {
          onInstall();
      } else {
          setIsInstructionsModalOpen(true);
      }
  };

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-card p-4 flex flex-col border-r z-40 transition-transform transform md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col items-center gap-3 mb-8">
            <Image
                src="/icon-192x192.png"
                alt="Logo De Casa em Casa"
                width={80}
                height={80}
                className="rounded-lg"
            />
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">De Casa em Casa</h1>
            
            <button onClick={onClose} className="md:hidden p-2 absolute top-4 right-4 text-gray-400">
                <X size={24} />
            </button>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                    {item.name === "Usuários" && pendingUsersCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-2 border-t pt-4">
          {user && (
            <div className="flex items-center space-x-3 text-left p-2 rounded-md w-full">
              <Avatar>
                <AvatarFallback>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.role}
                </p>
              </div>
            </div>
          )}
          {showInstallButton && (
              <Button
                onClick={handleInstallButtonClick}
                variant="outline"
                className="w-full justify-center border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:text-green-900 dark:border-green-700 dark:bg-green-900/50 dark:text-white dark:hover:bg-green-900/80"
              >
                <Download className="mr-2" size={20} /> Instalar Aplicativo
              </Button>
            )}
          <FeedbackModal />
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-center"
          >
            <LogOut className="mr-2" size={20} />
            Sair
          </Button>
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
    </>
  );
}
