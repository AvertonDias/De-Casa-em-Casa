
"use client";

import UserManagement from '@/components/users/UserManagement';
import withAuth from '@/components/withAuth';
import { useUser } from '@/contexts/UserContext';
import { RestrictedContent } from '@/components/RestrictedContent';

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

    return <UserManagement />;
}

export default withAuth(UsersPage);
