
"use client";

import { useUser } from '@/contexts/UserContext';
import { useRouter, usePathname } from 'next/navigation'; // Adiciona usePathname
import { useEffect, ComponentType } from 'react';
import { Loader } from 'lucide-react';

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
  
  const AuthComponent = (props: P) => {
    const { user, loading } = useUser();
    const router = useRouter();
    const pathname = usePathname();

    // Lógica de Renderização
    if (loading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader className="animate-spin text-primary" />
        </div>
      );
    }
    
    // Se a página for a de ação de autenticação, sempre renderize-a
    if (pathname.startsWith('/auth/action')) {
      return <WrappedComponent {...props} />;
    }

    if (user) {
      return <WrappedComponent {...props} />;
    }

    // Se não há usuário, o UserContext já está cuidando do redirecionamento.
    // Retornamos o loader para evitar renderizações indesejadas durante a transição.
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
