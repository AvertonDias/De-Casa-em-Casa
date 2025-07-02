
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { getToken } from 'firebase/messaging';
import { db, messaging } from "@/lib/firebase";
import { doc, arrayUnion, updateDoc } from 'firebase/firestore';
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";
import Image from 'next/image';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // Lógica de proteção simplificada: Apenas expulsa usuários não logados.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Lógica para pedir permissão de notificação para usuários ativos
  useEffect(() => {
    const requestPermission = async () => {
      // Garante que a permissão só seja pedida para usuários ativos no navegador
      if (user && user.status === 'ativo' && messaging && 'serviceWorker' in navigator) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            // Aguarda o service worker estar pronto para evitar race conditions
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
    requestPermission();
  }, [user]);

  // Enquanto o UserContext carrega, mostramos um loader.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <p>Verificando sua sessão...</p>
      </div>
    );
  }

  // Se o carregamento terminou e o usuário EXISTE (qualquer que seja seu status),
  // renderizamos o layout do painel.
  if (user) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-[#1e1b29]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between p-2 border-b bg-card">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                  <Menu />
              </Button>
              <h1 className="text-lg font-bold">De Casa em Casa</h1>
              <div className="w-10"></div> {/* Spacer para balancear o header */}
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {/* O banner de "pendente" é renderizado aqui, com base no status do usuário */}
            {user.status === 'pendente' && <PendingApprovalBanner />}

            {/* As páginas filhas renderizam aqui e controlam seu próprio conteúdo restrito */}
            {children}
          </main>
        </div>
      </div>
    );
  }
  
  // Se não está carregando e não há usuário, não renderiza nada (será redirecionado).
  return null;
}
