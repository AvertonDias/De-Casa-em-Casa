"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { PendingApprovalBanner } from "@/components/PendingApprovalBanner";
import { getToken } from 'firebase/messaging';
import { db, messaging } from "@/lib/firebase";
import { doc, arrayUnion, updateDoc } from 'firebase/firestore';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
        router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const requestPermission = async () => {
      // Check if user is loaded, notifications are supported, user is active, and messaging is available.
      if (user && user.status === 'ativo' && typeof window !== 'undefined' && 'Notification' in window && messaging) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messaging, { vapidKey: 'BD_279ckw7U8KPc5KFJX-8V2UFyvJhnWVqa-XgvJnb91RHf0bjBn21hDHMOKxq1Hb2bEFnOdeclWRnKKsbFfhbk' });
            if (token) {
              console.log('FCM Token:', token);
              // Salva o token no perfil do usuário no Firestore
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                fcmTokens: arrayUnion(token) // Usa arrayUnion para adicionar sem duplicar
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

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-foreground">Verificando sua sessão...</p>
      </div>
    );
  }

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
            <div className="w-10"></div> {/* Spacer to balance the header */}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
           {user?.status === 'pendente' && <PendingApprovalBanner />}
           {children}
        </main>
      </div>
    </div>
  );
}
