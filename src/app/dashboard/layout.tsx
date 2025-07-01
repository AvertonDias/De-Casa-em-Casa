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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // Lógica do "porteiro inteligente" para redirecionamento
  useEffect(() => {
    if (loading) {
      return; // Aguarda a verificação do usuário terminar
    }
    
    // Se não houver usuário, redireciona para o login
    if (!user) {
      router.replace('/');
      return;
    }

    // Se o usuário existir mas estiver pendente, redireciona para a "sala de espera"
    if (user.status === 'pendente') {
      router.replace('/aguardando-aprovacao');
      return;
    }
  }, [user, loading, router]);

  // Lógica para pedir permissão de notificação para usuários ativos
  useEffect(() => {
    const requestPermission = async () => {
      // Garante que a permissão só seja pedida para usuários ativos no navegador
      if (user && user.status === 'ativo' && typeof window !== 'undefined' && 'Notification' in window && messaging) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messaging, { vapidKey: 'BD_279ckw7U8KPc5KFJX-8V2UFyvJhnWVqa-XgvJnb91RHf0bjBn21hDHMOKxq1Hb2bEFnOdeclWRnKKsbFfhbk' });
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

  // Mostra um loader genérico enquanto as verificações acontecem
  if (loading || !user || user.status !== 'ativo') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <p>Verificando sua sessão e permissões...</p>
      </div>
    );
  }

  // Se todas as verificações passaram, renderiza o layout para o usuário ativo
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
           {children}
        </main>
      </div>
    </div>
  );
}
