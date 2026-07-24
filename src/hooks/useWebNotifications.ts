"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, messaging, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { type Notification as AppNotification } from '@/types/types';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function useWebNotifications() {
  const { user } = useUser();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(false);

  // Verificação inicial do suporte a notificações no navegador
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission as NotificationPermissionState);
    } else {
      setIsSupported(false);
      setPermission('unsupported');
    }
  }, []);

  // Exibir Notificação do Sistema via Service Worker ou Notification API
  const showSystemNotification = useCallback((title: string, body: string, link?: string) => {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

    const options = {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: [200, 100, 200],
      data: { url: link || '/dashboard/notificacoes' },
      tag: 'de-casa-em-casa-notif-' + Date.now()
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, options);
      }).catch(() => {
        try {
          new Notification(title, options);
        } catch (e) {
          console.warn("Erro ao instanciar notificação:", e);
        }
      });
    } else {
      try {
        new Notification(title, options);
      } catch (e) {
        console.warn("Erro ao instanciar notificação:", e);
      }
    }
  }, []);

  // Solicitar permissão de notificação no navegador
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Navegador não suportado",
        description: "Seu navegador atual não suporta notificações push de sistema.",
        variant: "destructive"
      });
      return false;
    }

    setLoadingPermission(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);

      if (result === 'granted') {
        let fcmToken = null;
        try {
          const { getToken } = await import('firebase/messaging');
          if (messaging) {
            fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BD_279ckw7U8KPc5KFJX-8V2UFyvJhnWVqa-XgvJnb91RHf0bjBn21hDHMOKxq1Hb2bEFnOdeclWRnKKsbFfhbk" });
          }
        } catch (fcmErr) {
          console.warn("Erro ao obter token do FCM:", fcmErr);
        }

        if (user?.uid) {
          const updateData: any = {
            pushNotificationsEnabled: true,
            pushSubscriptionUpdated: serverTimestamp()
          };
          if (fcmToken) {
            updateData.fcmToken = fcmToken;
          }
          await updateDoc(doc(db, 'users', user.uid), updateData).catch(console.warn);
        }

        toast({
          title: "Notificações ativadas! 🎉",
          description: "Você receberá alertas no seu celular/computador sobre territórios vencidos e novas designações.",
        });

        // Dispara notificação de boas-vindas
        showSystemNotification(
          "Notificações Ativadas!",
          "Tudo pronto! Você será notificado sobre territórios vencidos e novas designações.",
          "/dashboard/notificacoes"
        );
        return true;
      } else if (result === 'denied') {
        if (user?.uid) {
          await updateDoc(doc(db, 'users', user.uid), {
            pushNotificationsEnabled: false
          }).catch(console.warn);
        }

        toast({
          title: "Notificações bloqueadas",
          description: "A permissão foi negada no seu navegador. Para reativar, altere nas configurações de site do navegador.",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão de notificação:", error);
      toast({
        title: "Erro ao ativar notificações",
        description: "Não foi possível obter a permissão no seu dispositivo.",
        variant: "destructive"
      });
    } finally {
      setLoadingPermission(false);
    }
    return false;
  }, [isSupported, user?.uid, toast, showSystemNotification]);

  // Enviar uma notificação de teste
  const sendTestNotification = useCallback(() => {
    if (permission !== 'granted') {
      requestPermission();
      return;
    }

    showSystemNotification(
      "Teste de Notificação Push",
      "As notificações push do De Casa em Casa estão funcionando perfeitamente no seu dispositivo!",
      "/dashboard/notificacoes"
    );

    toast({
      title: "Notificação enviada!",
      description: "Verifique a central de notificações do seu celular ou sistema operacional.",
    });
  }, [permission, requestPermission, showSystemNotification, toast]);

  // Listener em tempo real para novas notificações não lidas no Firestore
  useEffect(() => {
    if (!user?.uid || permission !== 'granted') return;
    if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== user.uid) return;

    const notifPath = `users/${user.uid}/notifications`;
    const q = query(
      collection(db, notifPath),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as AppNotification;
          const notifId = change.doc.id;

          // Evita disparar alertas repetidos para notificações conhecidas na mesma sessão
          const sessionKey = `pwa_notified_${notifId}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'true');

            // Notifica o usuário no sistema do dispositivo/navegador
            showSystemNotification(
              data.title || "Nova notificação",
              data.body || "Você tem uma nova notificação no aplicativo De Casa em Casa.",
              data.link || "/dashboard/notificacoes"
            );
          }
        }
      });
    }, (err) => {
      console.warn("Erro no listener de notificações em tempo real:", err);
    });

    return () => unsubscribe();
  }, [user?.uid, permission, showSystemNotification]);

  return {
    permission,
    isSupported,
    loadingPermission,
    requestPermission,
    sendTestNotification,
    showSystemNotification
  };
}
