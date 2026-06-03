"use client";

import UserManagement from '@/components/users/UserManagement';
import withAuth from '@/components/withAuth';
import { useUser } from '@/contexts/UserContext';
import { RestrictedContent } from '@/components/RestrictedContent';
import { TutorialButton } from '@/components/TutorialButton';
import { TUTORIAL_IDS } from '@/lib/tutorials';

function UsersPage() {
    const { user } = useUser();
    
    const canAccess = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios';

    if (!canAccess) {
        return (
            <RestrictedContent
                title="Acesso Negado"
                message="Você não tem permissão para visualizar a página de gerenciamento de usuários."
            />
        )
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end px-4 md:px-0">
          <TutorialButton 
            videoId={TUTORIAL_IDS.ACCEPT_USER} 
            label="Como aprovar usuários"
          />
        </div>
        <UserManagement />
      </div>
    );
}

export default withAuth(UsersPage);