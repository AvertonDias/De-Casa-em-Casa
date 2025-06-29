"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

export default function WaitingForApprovalPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading && user) {
      if (user.status === 'ativo') {
        router.replace('/dashboard');
      } else if (user.status === 'rejeitado') {
        // Opcional: lidar com o status rejeitado, talvez redirecionar para uma página de erro.
        // Por enquanto, o usuário ficará aqui. Poderíamos adicionar uma mensagem de erro.
      }
    }
    
    // Se o usuário deslogar ou a sessão expirar, volta para a home
    if (!loading && !user) {
        router.replace('/');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  // Enquanto o UserContext carrega ou se o status não for 'pendente', mostra um loader.
  // Isso evita que um usuário já ativo veja esta página por um instante.
  if (loading || !user || user.status !== 'pendente') {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
            <p>Verificando seu status...</p>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-background p-4 text-center">
      <h1 className="text-3xl font-bold text-foreground mb-4">Aguardando Aprovação</h1>
      <p className="text-lg text-muted-foreground max-w-md mb-8">
        Sua solicitação de acesso foi enviada. Um administrador precisa aprovar sua entrada para que você possa acessar o painel.
      </p>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Você será redirecionado automaticamente assim que for aprovado. Se fechar esta página, basta fazer login novamente para verificar seu status.
      </p>
      <Button 
        onClick={handleLogout}
        variant="destructive"
      >
        <LogOut size={20} className="mr-2" />
        Sair
      </Button>
    </div>
  );
}
