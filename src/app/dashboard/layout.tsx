
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Home, Map, Users, LogOut, Menu, X, Sun, Moon, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';
import { FeedbackModal } from "@/components/FeedbackModal";
import { useUser } from '@/contexts/UserContext';

// --- Componente de Troca de Tema ---
function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // Garante que o ícone correto seja exibido após a montagem no cliente
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />; // Placeholder para evitar "flicker"

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-purple-900/50"
      aria-label="Trocar tema"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

// --- Componente do Menu Lateral Responsivo com Temas ---
function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const navLinks = [
    { name: "Início", href: "/dashboard", icon: Home },
    { name: "Territórios", href: "/dashboard/territorios", icon: Map },
    { name: "Usuários", href: "/dashboard/usuarios", icon: Users },
    { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
  ];

  const isLinkActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay para escurecer o fundo no modo mobile */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* O menu lateral em si */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#2f2b3a] p-4 flex flex-col border-r border-gray-200 dark:border-gray-700 z-40 transition-transform transform md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8 pl-2">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">De Casa em Casa</h1>
            {/* Botão de tema visível no desktop e no menu aberto */}
            <div className="hidden md:block">
              <ThemeSwitcher />
            </div>
            <button onClick={onClose} className="md:hidden text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <X size={24} />
            </button>
          </div>
          <nav className="flex-1">
            <ul>
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href);
                return (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(link.href);
                        onClose(); // Fecha o menu na navegação mobile
                      }}
                      className={`flex items-center text-md p-3 rounded-lg mb-2 transition-colors ${
                        isActive
                          ? 'bg-purple-600 text-white font-semibold shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-purple-600/20'
                      }`}
                    >
                      <link.icon className="mr-3" size={20} />
                      {link.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          
          {/* Card de Usuário Apenas Informativo */}
          <div className="flex items-center space-x-2 text-left p-2 rounded-md w-full">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          <FeedbackModal />
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-4 py-2 font-semibold bg-red-100 text-red-700 dark:bg-red-600/80 dark:text-white rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
          >
            <LogOut className="mr-2" size={20}/>
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

// --- Layout Principal Responsivo com Temas ---
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading: userLoading } = useUser();
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Estado para controlar o menu
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (userLoading) return <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#1e1b29] text-gray-800 dark:text-white">Verificando autenticação...</div>;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-[#1e1b29]">
      {/* Passando o estado e a função de fechamento para a Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header visível apenas em telas pequenas (mobile) */}
        <header className="md:hidden bg-white dark:bg-[#2f2b3a] p-4 text-gray-800 dark:text-white shadow-md flex justify-between items-center">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold">De Casa em Casa</h1>
          <ThemeSwitcher />
        </header>
        
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
