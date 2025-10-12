
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export function UpdateProfileBanner({ onUpdateProfileClick }: { onUpdateProfileClick: () => void }) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // O banner é visível se o usuário estiver logado e não tiver WhatsApp
    if (user && !user.whatsapp) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleUpdateClick = () => {
    setIsOpen(false);
    onUpdateProfileClick();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center">
             <Info size={48} className="text-primary"/>
          </div>
          <DialogTitle className="text-center text-2xl font-bold mt-4">Complete seu Perfil</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Seu número de WhatsApp ainda não foi cadastrado. Para receber notificações importantes, por favor, atualize seu perfil com esta informação.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center pt-4">
          <Button type="button" onClick={handleUpdateClick} className="w-full sm:w-auto">
            Atualizar Perfil Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
