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
  // O estado do modal de perfil foi movido para o layout.

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e dados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {/* O Card de Editar Perfil foi removido daqui */}
        
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
      
      {/* O modal de edição de perfil agora é renderizado e controlado pelo layout principal */}
    </div>
  );
}

export default withAuth(SettingsPage);
