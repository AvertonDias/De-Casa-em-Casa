
"use client";

import { useUser } from '@/contexts/UserContext';
import { useRouter, usePathname } from 'next/navigation';
import { ComponentType } from 'react';
import { Loader } from 'lucide-react';

const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
  
  const AuthComponent = (props: P) => {
    const { user, loading } = useUser();
    const pathname = usePathname();

    // Enquanto o UserContext estiver decidindo o destino, mostramos o loader.
    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader className="animate-spin text-primary" />
            </div>
        );
    }
    
    // Se não há usuário ou a página de destino não condiz com o status,
    // o UserContext redirecionará. Retornamos o loader para evitar flicker.
    if (!user) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader className="animate-spin text-primary" />
        </div>
      );
    }

    // Se o usuário existe e o carregamento terminou, renderizamos a página.
    // O switch de rotas no UserContext garantirá que ele esteja no lugar certo.
    return <WrappedComponent {...props} />;
  };
  
  AuthComponent.displayName = `withAuth(${WrappedComponent.displayName || 'Component'})`;
  
  return AuthComponent;
};

export default withAuth;
