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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/firebase";
import { FeedbackModal } from "@/components/FeedbackModal";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Territórios", href: "/dashboard/territorios", icon: Map },
  { name: "Usuários", href: "/dashboard/usuarios", icon: Users },
  { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

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
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
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
                <AvatarImage src={`https://i.pravatar.cc/150?u=${user.uid}`} />
                <AvatarFallback>
                  {user.name?.split(" ").map((n) => n[0]).join("")}
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
