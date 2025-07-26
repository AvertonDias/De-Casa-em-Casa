"use client";

import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { EditCongregationModal } from '@/components/EditCongregationModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import { User as UserIcon, House, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import withAuth from '@/components/withAuth';

function SettingsPage() {
  const { user } = useUser();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e dados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {/* Card 1: Editar Perfil Pessoal */}
        <div className="bg-card p-6 rounded-lg shadow-md flex flex-col">
          <div className="flex items-center mb-4">
            <UserIcon className="h-6 w-6 mr-3 text-primary" />
            <h2 className="text-2xl font-bold">Meu Perfil</h2>
          </div>
          <p className="text-muted-foreground mb-6 flex-grow">
            Altere seu nome de exibição e sua senha de acesso.
          </p>
          <Button onClick={() => setIsProfileModalOpen(true)} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center">
            <Edit className="h-4 w-4 mr-2" /> Editar Perfil
          </Button>
        </div>

        {/* Card 2: Editar Congregação */}
        {['Administrador', 'Dirigente'].includes(user?.role || '') && (
          <div className="bg-card p-6 rounded-lg shadow-md flex flex-col">
            <div className="flex items-center mb-4">
              <House className="h-6 w-6 mr-3 text-primary" />
              <h2 className="text-2xl font-bold">Minha Congregação</h2>
            </div>
            <p className="text-muted-foreground mb-6 flex-grow">
              Altere os dados da sua congregação. Apenas administradores podem editar.
            </p>
            <EditCongregationModal disabled={user?.role !== 'Administrador'} />
          </div>
        )}
      </div>

      {/* O Modal de Edição de Perfil é renderizado aqui e controlado pelo estado */}
      <EditProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
}

export default withAuth(SettingsPage);
