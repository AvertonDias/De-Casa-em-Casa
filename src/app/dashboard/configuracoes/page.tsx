"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { EditCongregationModal } from '@/components/EditCongregationModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import { User as UserIcon, House, Share2, Copy } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function SettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [congregationCode, setCongregationCode] = useState('');

  useEffect(() => {
    if (user?.congregationId && ['Administrador', 'Dirigente'].includes(user.role)) {
      const fetchCongregationCode = async () => {
        const congRef = doc(db, 'congregations', user.congregationId!);
        const congSnap = await getDoc(congRef);
        if (congSnap.exists()) {
          setCongregationCode(congSnap.data().code);
        }
      };
      fetchCongregationCode();
    }
  }, [user]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(congregationCode);
    toast({
      title: "Código Copiado!",
      description: "O código de convite foi copiado para sua área de transferência.",
    });
  };

  return (
    <div className="text-gray-800 dark:text-white">
      <h1 className="text-4xl font-bold mb-8">Configurações</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Editar Perfil Pessoal */}
        <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex flex-col">
          <div className="flex items-center mb-4">
            <UserIcon className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />
            <h2 className="text-2xl font-bold">Meu Perfil</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
            Altere seu nome de exibição e sua senha de acesso.
          </p>
          <EditProfileModal />
        </div>

        {/* Card 2: Editar Congregação */}
        {['Administrador', 'Dirigente'].includes(user?.role || '') && (
          <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md flex flex-col">
            <div className="flex items-center mb-4">
              <House className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />
              <h2 className="text-2xl font-bold">Minha Congregação</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow">
              Altere os dados da sua congregação. Somente administradores podem editar.
            </p>
            <EditCongregationModal disabled={user?.role !== 'Administrador'} />
          </div>
        )}
        
        {/* Card 3: Código de Convite */}
        {['Administrador', 'Dirigente'].includes(user?.role || '') && (
          <div className="bg-white dark:bg-[#2f2b3a] p-6 rounded-lg shadow-md md:col-span-2">
            <div className="flex items-center mb-4">
              <Share2 className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />
              <h2 className="text-2xl font-bold">Código de Convite</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Compartilhe este código com os publicadores para que eles possam se juntar à sua congregação.
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg flex items-center justify-between">
              <p className="text-3xl font-mono tracking-widest text-gray-800 dark:text-white">
                {congregationCode || '...'}
              </p>
              <Button onClick={handleCopyCode} variant="ghost" size="icon">
                <Copy className="h-6 w-6" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
