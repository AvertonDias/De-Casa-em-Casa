
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MailCheck, Info } from 'lucide-react';

const ANNOUNCEMENT_KEY = 'feedback-announcement-seen-v1';

export function FeedbackAnnouncementModal({ onOpenProfileModal }: { onOpenProfileModal: () => void; }) {
  const { user } = useUser();
  const [stage, setStage] = useState<'hidden' | 'feedback' | 'profile'>('hidden');

  useEffect(() => {
    if (!user) return;
    
    const hasSeenAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);
    if (!hasSeenAnnouncement) {
      setStage('feedback');
    } else if (!user.whatsapp) {
      setStage('profile');
    }
  }, [user]);

  const handleCloseFeedback = () => {
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true');
    if (!user?.whatsapp) {
      setStage('profile');
    } else {
      setStage('hidden');
    }
  };

  const handleUpdateProfile = () => {
    setStage('hidden');
    onOpenProfileModal();
  };
  
  const isOpen = stage !== 'hidden';
  
  const renderContent = () => {
      switch (stage) {
          case 'feedback':
              return (
                <>
                  <DialogHeader>
                    <div className="flex justify-center">
                       <MailCheck size={48} className="text-primary"/>
                    </div>
                    <DialogTitle className="text-center text-2xl font-bold mt-4">Nova Funcionalidade!</DialogTitle>
                    <DialogDescription className="text-center text-base pt-2">
                      A opção de **"Enviar Feedback"** no menu lateral agora está ativa! Use-a para nos enviar suas sugestões, relatar problemas ou fazer elogios.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="sm:justify-center pt-4">
                    <Button type="button" onClick={handleCloseFeedback} className="w-full sm:w-auto">
                      Ok, entendi
                    </Button>
                  </DialogFooter>
                </>
              );
          case 'profile':
              return (
                <>
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
                    <Button type="button" onClick={handleUpdateProfile} className="w-full sm:w-auto">
                      Atualizar Perfil Agora
                    </Button>
                  </DialogFooter>
                </>
              );
          default:
              return null;
      }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}

    