"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, messaging, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { type Notification as AppNotification } from '@/types/types';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function useWebNotifications() {
  const { user } = useUser();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(false);

  // Verificação inicial do suporte a notificações no navegador ou aplicativo nativo Capacitor
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (Capacitor.isNativePlatform()) {
        setIsSupported(true);
        LocalNotifications.checkPermissions().then((status) => {
          if (status.display === 'granted') {
            setPermission('granted');
          } else if (status.display === 'denied') {
            setPermission('denied');
          } else {
            setPermission('default');
          }
        }).catch(() => setPermission('default'));
      } else if ('Notification' in window) {
        setIsSupported(true);
        setPermission(Notification.permission as NotificationPermissionState);
      } else {
        setIsSupported(false);
        setPermission('unsupported');
      }
    }
  }, []);

  // Exibir Notificação do Sistema via Capacitor Native ou Web Service Worker / Notification API
  const showSystemNotification = useCallback((title: string, body: string, link?: string) => {
    if (typeof window === 'undefined') return;

    const targetUrl = link || '/dashboard/notificacoes';

    // Suporte para aplicativo Android/iOS via Capacitor APK
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.schedule({
        notifications: [
          {
            title: title || 'Nova Notificação 🗺️',
            body: body || 'Você possui uma nova mensagem ou território.',
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100) },
            extra: { url: targetUrl },
            actionTypeId: '',
          }
        ]
      }).catch((err) => {
        console.warn("Erro ao disparar notificação local no Capacitor:", err);
      });
      return;
    }

    // Suporte para navegadores web e PWA
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const options: any = {
      body,
      icon: '/images/Logo_v3.png',
      badge: '/images/Logo_v3.png',
      vibrate: [200, 100, 200],
      data: { url: targetUrl },
      tag: 'de-casa-em-casa-notif-' + Date.now()
    };

    const sendDirectNotification = () => {
      try {
        new Notification(title, options);
      } catch (e) {
        console.warn("Construtor direto de Notificação não suportado ou bloqueado:", e);
      }
    };

    if ('serviceWorker' in navigator) {
      (async () => {
        try {
          // Garante o registro do Service Worker
          let reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          }

          // Aguarda o Service Worker ficar ativado (ready) no Chrome/Edge/Samsung Internet
          const readyPromise = navigator.serviceWorker.ready;
          const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 2000));
          const activeReg = (await Promise.race([readyPromise, timeoutPromise])) || reg;

          if (activeReg && 'showNotification' in activeReg) {
            await activeReg.showNotification(title, options);
            return;
          }
        } catch (err) {
          console.warn("Erro ao notificar via ServiceWorker:", err);
        }
        sendDirectNotification();
      })();
    } else {
      sendDirectNotification();
    }
  }, []);

  // Função dedicada para obter e sincronizar o token FCM no Web/PWA
  const syncWebFcmToken = useCallback(async (userId: string) => {
    if (typeof window === 'undefined' || !isSupported || Capacitor.isNativePlatform()) return null;

    try {
      if (!('serviceWorker' in navigator) || !messaging) return null;

      // 1. Obter ou registrar o Service Worker principal (/sw.js)
      let swRegistration = await navigator.serviceWorker.getRegistration();
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }

      // 2. Aguardar o Service Worker estar pronto/ativo
      const readyRegistration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((res) => setTimeout(() => res(undefined), 3500))
      ]);

      const activeSw = readyRegistration || swRegistration;

      const { getToken } = await import('firebase/messaging');
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BD_279ckw7U8KPc5KFJX-8V2UFyvJhnWVqa-XgvJnb91RHf0bjBn21hDHMOKxq1Hb2bEFnOdeclWRnKKsbFfhbk";

      // 3. Gerar o token informando explicitamente a inscrição do Service Worker
      const fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: activeSw
      });

      if (fcmToken && userId) {
        await updateDoc(doc(db, 'users', userId), {
          fcmToken,
          pushNotificationsEnabled: true,
          notificationPromptHandled: true,
          pushSubscriptionUpdated: serverTimestamp()
        }).catch(console.warn);
        console.log("[FCM] Token gerado e salvo com sucesso:", fcmToken);
        return fcmToken;
      }
    } catch (fcmErr) {
      console.warn("[FCM] Erro ao obter token do FCM no navegador:", fcmErr);
    }
    return null;
  }, [isSupported]);

  // Listener para captura do token nativo no Android (Capacitor)
  useEffect(() => {
    if (Capacitor.isNativePlatform() && user?.uid) {
      let listener: any = null;
      try {
        listener = PushNotifications.addListener('registration', async (token) => {
          if (token?.value) {
            console.log('[Capacitor Push] Token recebido:', token.value);
            await updateDoc(doc(db, 'users', user.uid), {
              fcmToken: token.value,
              pushNotificationsEnabled: true,
              notificationPromptHandled: true,
              pushSubscriptionUpdated: serverTimestamp(),
              platform: 'capacitor_android'
            }).catch(console.warn);
          }
        });
      } catch (err) {
        console.warn("[Capacitor Push] Erro ao registrar listener:", err);
      }

      return () => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      };
    }
  }, [user?.uid]);

  // Tentar sincronizar/gerar o token automaticamente ao abrir o app se a permissão já estiver concedida
  useEffect(() => {
    if (user?.uid && permission === 'granted' && !Capacitor.isNativePlatform()) {
      syncWebFcmToken(user.uid);
    }
  }, [user?.uid, permission, syncWebFcmToken]);

  // Solicitar permissão de notificação no navegador ou Android APK
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Dispositivo não suportado",
        description: "Seu sistema ou navegador atual não suporta notificações push de sistema.",
        variant: "destructive"
      });
      return false;
    }

    setLoadingPermission(true);

    try {
      // 1. Se estiver rodando como APK no Android (Capacitor)
      if (Capacitor.isNativePlatform()) {
        const localPerm = await LocalNotifications.requestPermissions();
        let pushGranted = false;

        try {
          const pushPerm = await PushNotifications.requestPermissions();
          if (pushPerm.receive === 'granted') {
            await PushNotifications.register();
            pushGranted = true;
          }
        } catch (pushErr) {
          console.warn("PushNotifications register error:", pushErr);
        }

        if (localPerm.display === 'granted' || pushGranted) {
          setPermission('granted');

          if (user?.uid) {
            await updateDoc(doc(db, 'users', user.uid), {
              pushNotificationsEnabled: true,
              notificationPromptHandled: true,
              pushSubscriptionUpdated: serverTimestamp(),
              platform: 'capacitor_android'
            }).catch(console.warn);
          }

          toast({
            title: "Notificações no Android Ativadas! 🎉",
            description: "Você receberá alertas no seu celular sempre que um novo território for designado.",
          });

          showSystemNotification(
            "Notificações Ativadas! 🗺️",
            "Tudo pronto! Você receberá alertas no seu Android sobre territórios e notificações.",
            "/dashboard/notificacoes"
          );
          return true;
        } else {
          setPermission('denied');
          toast({
            title: "Permissão negada no Android",
            description: "Permita as notificações nas configurações do seu celular.",
            variant: "destructive"
          });
          return false;
        }
      }

      // 2. Se estiver rodando via Navegador Web / PWA
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);

      if (result === 'granted') {
        let fcmToken = null;
        if (user?.uid) {
          fcmToken = await syncWebFcmToken(user.uid);
        }

        if (user?.uid && !fcmToken) {
          await updateDoc(doc(db, 'users', user.uid), {
            pushNotificationsEnabled: true,
            notificationPromptHandled: true,
            pushSubscriptionUpdated: serverTimestamp()
          }).catch(console.warn);
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
            pushNotificationsEnabled: false,
            notificationPromptHandled: true
          }).catch(console.warn);
        }

        toast({
          title: "Notificações bloqueadas",
          description: "A permissão foi negada no navegador. Para reativar, altere nas configurações de site.",
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

  // Desativar notificações push no perfil do usuário
  const disableNotifications = useCallback(async () => {
    if (!user?.uid) return false;
    setLoadingPermission(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pushNotificationsEnabled: false,
        notificationPromptHandled: true,
        pushSubscriptionUpdated: serverTimestamp()
      });
      toast({
        title: "Notificações Desativadas 🔕",
        description: "Você desativou os alertas de notificação push no aplicativo.",
      });
      return true;
    } catch (err) {
      console.error("Erro ao desativar notificações:", err);
      toast({
        title: "Erro ao desativar",
        description: "Não foi possível desativar as notificações no momento.",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoadingPermission(false);
    }
  }, [user?.uid, toast]);

  // Enviar uma notificação de teste
  const sendTestNotification = useCallback(() => {
    if (permission !== 'granted') {
      requestPermission();
      return;
    }

    showSystemNotification(
      "Teste de Notificação Push 🗺️",
      "As notificações push do De Casa em Casa estão funcionando perfeitamente no seu aplicativo!",
      "/dashboard/notificacoes"
    );

    toast({
      title: "Notificação enviada!",
      description: "Verifique a central de notificações do seu celular.",
    });
  }, [permission, requestPermission, showSystemNotification, toast]);

  // Listener em tempo real para novas notificações não lidas no Firestore
  useEffect(() => {
    if (!user?.uid) return;
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

            // Notifica o usuário no sistema do dispositivo (Capacitor Native ou Web Browser)
            showSystemNotification(
              data.title || "Nova notificação 🗺️",
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
  }, [user?.uid, showSystemNotification]);

  return {
    permission,
    isSupported,
    loadingPermission,
    requestPermission,
    disableNotifications,
    sendTestNotification,
    showSystemNotification
  };
}

