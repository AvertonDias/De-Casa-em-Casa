"use client";

import { useUser } from '@/contexts/UserContext';
import { SettingsModal } from '@/components/EditCongregationModal'; 
import { User as UserIcon, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { user } = useUser();

  return (
    <div className="text-gray-800 dark:text-white">
      <h1 className="text-4xl font-bold mb-8">Configurações</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex flex-col">
          <div className="flex items-center mb-4">
            <UserIcon className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />
            <h2 className="text-2xl font-bold">Meu Perfil</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
            Altere seu nome de exibição e sua senha de acesso. O botão para editar está no canto inferior esquerdo do menu.
          </p>
        </div>

        {user?.role === 'Administrador' && (
          <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex flex-col">
            <div className="flex items-center mb-4">
              <Landmark className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />
              <h2 className="text-2xl font-bold">Minha Congregação</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
              Altere os dados da sua congregação e do seu perfil de administrador.
            </p>
            <SettingsModal /> 
          </div>
        )}

      </div>
    </div>
  );
}
