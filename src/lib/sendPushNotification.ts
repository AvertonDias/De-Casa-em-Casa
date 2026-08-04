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
    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
