"use client";

import { useUser } from '@/contexts/UserContext';
import { useRouter, usePathname } from 'next/navigation'; // Adiciona usePathname
import { useEffect, ComponentType } from 'react';
import { Loader } from 'lucide-react';

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
  
  const AuthComponent = (props: P) => {
    const { user, loading } = useUser();
    const router = useRouter();
    const pathname = usePathname(); // Pega o caminho da URL

    useEffect(() => {
      // ▼▼▼ GUARDA DE SEGURANÇA ▼▼▼
      // Se estamos carregando os dados ou o pathname ainda não está pronto, não fazemos nada.
      if (loading || !pathname) return;

      const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/aguardando-aprovacao');

      // Se não há usuário e a página é protegida, redireciona.
      if (!user && isProtectedPage) {
        router.replace('/login');
      }
      
      if (user) {
        // Se está pendente e não está na página de espera, redireciona.
        if (user.status === 'pendente' && pathname !== '/aguardando-aprovacao') {
          router.replace('/aguardando-aprovacao');
        }
        // Se está ativo e tenta acessar uma página de login, redireciona para o dashboard.
        if (user.status === 'ativo' && !isProtectedPage && pathname !== '/sobre') {
          router.replace('/dashboard');
        }
      }
    }, [user, loading, router, pathname]);

    // Lógica de Renderização
    // Enquanto carrega, mostra uma tela de loading global.
    if (loading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader className="animate-spin text-primary" />
        </div>
      );
    }
    
    // Se o usuário existe e está ativo, ou se a página é para um usuário pendente
    if (user && (user.status === 'ativo' || pathname === '/aguardando-aprovacao')) {
      return <WrappedComponent {...props} />;
    }
    
    // Se não há usuário e a página é pública, permite a renderização
    if (!user && !pathname?.startsWith('/dashboard')) {
        return <WrappedComponent {...props} />;
    }

    // Caso de fallback enquanto o redirecionamento acontece.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader className="animate-spin text-primary" />
        </div>
    );
  };
  
  AuthComponent.displayName = `withAuth(${WrappedComponent.displayName || 'Component'})`;
  
  return AuthComponent;
};

export default withAuth;
