"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Users,
  Settings,
  LogOut,
  X,
  Laptop,
  Sun,
  Moon,
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

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ['Administrador', 'Dirigente', 'Publicador'] },
  { name: "Territórios", href: "/dashboard/territorios", icon: Map, roles: ['Administrador', 'Dirigente', 'Publicador'] },
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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-foreground">De Casa em Casa</h1>
          <div className="flex items-center">
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="md:hidden"
            >
              <X size={24} />
            </Button>
          </div>
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
                      <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse"></span>
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
                  {user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
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
    </>
  );
}
