
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UpdateProfileBanner({ onUpdateProfileClick }: { onUpdateProfileClick: () => void }) {
  const { user } = useUser();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // O banner é visível se o usuário estiver logado e não tiver WhatsApp
    if (user && !user.whatsapp) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [user]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="mx-4 md:mx-8 mb-6 p-4 bg-blue-100 border border-l-4 border-blue-400 rounded-lg dark:bg-blue-900/30 dark:border-blue-500/60 dark:border-l-blue-500 flex items-start justify-between gap-4">
      <div className="flex items-start">
        <Info className="h-5 w-5 mr-3 mt-0.5 text-blue-500 dark:text-blue-400" />
        <div>
          <h3 className="font-bold text-blue-900 dark:text-blue-200">Complete seu Perfil</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Seu número de WhatsApp ainda não foi cadastrado. Para prosseguir, por favor, atualize seu perfil com esta informação.
          </p>
          <Button 
            variant="link" 
            className="p-0 h-auto mt-2 text-blue-800 dark:text-blue-300 font-bold"
            onClick={onUpdateProfileClick}
          >
            Atualizar Perfil Agora
          </Button>
        </div>
      </div>
    </div>
  );
}
