"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useWebNotifications } from '@/hooks/useWebNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BellRing, Milestone, AlertTriangle, Bell, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const LOCAL_DISMISSED_KEY = 'de_casa_em_casa_notif_modal_dismissed';

export function NotificationPermissionModal() {
  const { user, updateUser } = useUser();
  const { isSupported, permission, requestPermission, loadingPermission } = useWebNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingDismiss, setLoadingDismiss] = useState(false);

  useEffect(() => {
    // Exibir o modal apenas quando:
    // 1. O usuário estiver logado e com status 'ativo' (já tem cadastro aprovado)
    // 2. Já tiver aceito os termos da LGPD (user.acceptedLGPD === true)
    // 3. Ainda não tiver tratado a permissão de notificações (user.notificationPromptHandled !== true)
    // 4. O dispositivo suportar notificações e o modal não tiver sido descartado localmente
    if (
      user &&
      user.status === 'ativo' &&
      user.acceptedLGPD === true &&
      user.notificationPromptHandled !== true &&
      isSupported
    ) {
      const localDismissed = localStorage.getItem(LOCAL_DISMISSED_KEY);

      // Se as notificações já estiverem concedidas no navegador/app e ativadas no perfil, ajusta a flag silenciosamente
      if (permission === 'granted' && user.pushNotificationsEnabled === true) {
        if (user.uid) {
          updateDoc(doc(db, 'users', user.uid), { notificationPromptHandled: true }).catch(console.warn);
        }
        setIsOpen(false);
        return;
      }

      if (!localDismissed) {
        // Pequeno delay para que o modal apareça de forma suave após os termos da LGPD
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } else {
      setIsOpen(false);
    }
  }, [user, isSupported, permission]);

  if (!isOpen) return null;

  const handleAccept = async () => {
    const success = await requestPermission();
    if (user?.uid) {
      await updateUser({
        notificationPromptHandled: true,
        pushNotificationsEnabled: success
      }).catch(console.warn);
    }
    setIsOpen(false);
  };

  const handleDismiss = async () => {
    setLoadingDismiss(true);
    localStorage.setItem(LOCAL_DISMISSED_KEY, 'true');
    try {
      if (user?.uid) {
        await updateUser({
          notificationPromptHandled: true,
          pushNotificationsEnabled: false
        }).catch(console.warn);
      }
    } finally {
      setLoadingDismiss(false);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent 
        className="max-w-md w-[95vw] p-6 rounded-2xl border border-border/80 shadow-2xl bg-card"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 flex flex-col items-center text-center">
          <div className="p-3.5 bg-primary/10 text-primary rounded-2xl animate-bounce">
            <BellRing className="h-9 w-9" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Ativar Notificações do App</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Mantenha-se informado sobre os territórios da sua congregação sem precisar abrir o app constantemente.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 space-y-3 bg-muted/40 p-4 rounded-xl border border-border/60 text-sm">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wider text-center">Você receberá alertas para:</p>
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <Milestone className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <span><strong>Novos territórios:</strong> Quando um território for designado para você.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span><strong>Prazos e vencimentos:</strong> Lembrete automático quando a devolução estiver próxima.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bell className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Avisos importantes:</strong> Notificações enviadas pelos servos de territórios.</span>
            </li>
          </ul>
        </div>

        <DialogFooter className="flex flex-col sm:flex-col gap-2.5 mt-2">
          <Button 
            type="button" 
            onClick={handleAccept} 
            disabled={loadingPermission || loadingDismiss}
            className="w-full font-bold h-11 gap-2 shadow-sm"
          >
            {loadingPermission ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                Ativando Notificações...
              </>
            ) : (
              <>
                <BellRing className="h-4 w-4" />
                Permitir Notificações
              </>
            )}
          </Button>

          <Button 
            type="button" 
            variant="ghost" 
            onClick={handleDismiss}
            disabled={loadingPermission || loadingDismiss}
            className="w-full text-muted-foreground text-xs hover:bg-muted"
          >
            Agora não (ativar mais tarde nas configurações)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
