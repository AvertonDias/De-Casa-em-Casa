import { auth } from '@/lib/firebase';

export interface SendPushNotificationOptions {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  link?: string;
  type?: string;
  notifId?: string;
}

export async function sendPushNotification(options: SendPushNotificationOptions) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn('[Push Client] Nenhum usuário autenticado; notificação não enviada.');
      return null;
    }

    // A API agora exige um token de ID do Firebase válido (ver
    // src/app/api/notifications/send/route.ts) para impedir que qualquer
    // pessoa não autenticada dispare notificações arbitrárias.
    const idToken = await currentUser.getIdToken();

    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(options)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("[Push Client] Erro ao disparar notificação push via API:", err);
    return null;
  }
}