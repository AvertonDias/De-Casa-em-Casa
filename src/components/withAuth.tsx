"use client";

import { useUser } from '@/contexts/UserContext';
import { ComponentType } from 'react';
import { Loader } from 'lucide-react';
import { RestrictedContent } from '@/components/RestrictedContent';
import type { AppUser } from '@/types/types';

/**
 * @param allowedRoles Lista opcional de papéis que podem ver a página. Se
 * omitido, qualquer usuário autenticado passa (comportamento antigo).
 * IMPORTANTE: isto é só uma camada de UX — a proteção de verdade tem que
 * estar nas firestore.rules e nas API routes, já que este código roda no
 * navegador do usuário e pode ser contornado.
 */
const withAuth = <P extends object>(
  WrappedComponent: ComponentType<P>,
  allowedRoles?: AppUser['role'][]
) => {

  const AuthComponent = (props: P) => {
    const { user, loading } = useUser();

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader className="animate-spin text-primary" />
            </div>
        );
    }

    // Se não há usuário, o UserContext cuida do redirecionamento.
    // Retornamos o loader para evitar flicker.
    if (!user) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader className="animate-spin text-primary" />
        </div>
      );
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return (
        <div className="p-4">
          <RestrictedContent
            title="Acesso Restrito"
            message="Você não tem permissão para acessar esta página."
          />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  AuthComponent.displayName = `withAuth(${WrappedComponent.displayName || 'Component'})`;

  return AuthComponent;
};

export default withAuth;