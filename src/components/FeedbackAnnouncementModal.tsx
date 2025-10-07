"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MailCheck } from 'lucide-react';

// A chave no localStorage para lembrar se o usuário já viu o anúncio.
// Se precisarmos mostrar um novo anúncio no futuro, podemos mudar para 'v2'.
const ANNOUNCEMENT_KEY = 'feedback-announcement-seen-v1';

export function FeedbackAnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Roda apenas no navegador.
    // Verifica no localStorage se o usuário já viu este anúncio.
    const hasSeenAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);
    
    // Se a chave não existir no localStorage, abre o modal.
    if (!hasSeenAnnouncement) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    // Marca o anúncio como visto no localStorage.
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true');
    // Fecha o modal.
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
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
          <Button type="button" onClick={handleClose} className="w-full sm:w-auto">
            Ok, entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
