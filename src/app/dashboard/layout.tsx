"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import ApprovalBanner from '@/components/ApprovalBanner';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) {
            router.push('/');
        } else {
            setLoading(false);
        }
    });

    const timer = setTimeout(() => {
        if (auth.currentUser) {
            setLoading(false);
        } else {
            router.push('/');
        }
    }, 1500);

    return () => {
        unsubscribe();
        clearTimeout(timer);
    };
  }, [router]);

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
        <main className="flex-1 overflow-y-auto">
           <div className="p-4 md:p-8">
            <ApprovalBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
