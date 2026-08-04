// Service Worker do Firebase Messaging para PWA
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const firebaseConfig = {
  projectId: "appterritorios-e5bb5",
  appId: "1:83629039662:web:42d410f411b2e9b33fffbf",
  apiKey: "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  messagingSenderId: "83629039662",
  storageBucket: "appterritorios-e5bb5.appspot.com",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

console.log('✅ [SW] Firebase Messaging Service Worker inicializado.');
console.log('📡 [SW FCM] Escutando notificações push enviadas pelo servidor da Vercel em segundo plano.');

messaging.onBackgroundMessage((payload) => {
  console.log("Mensagem FCM recebida em segundo plano: ", payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || "De Casa em Casa";
  const uniqueTag = payload.notification?.tag || payload.data?.tag || ("de-casa-em-casa-" + Date.now() + "-" + Math.floor(Math.random() * 10000));

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: payload.notification?.icon || payload.data?.icon || "/images/Logo_v3.png",
    badge: payload.notification?.badge || payload.data?.badge || "/images/De casa em casa pb.png",
    tag: uniqueTag,
    renotify: true,
    data: {
      url: payload.data?.link || payload.notification?.click_action || "/dashboard/notificacoes"
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    console.log('[SW] Push bruto recebido em segundo plano:', payload);

    const title = payload.notification?.title || payload.data?.title || payload.title || "De Casa em Casa";
    const body = payload.notification?.body || payload.data?.body || payload.body || "";
    const icon = payload.notification?.icon || payload.data?.icon || "/images/Logo_v3.png";
    const badge = payload.notification?.badge || payload.data?.badge || "/images/De casa em casa pb.png";
    const url = payload.data?.link || payload.notification?.click_action || payload.link || "/dashboard/notificacoes";
    const tag = payload.notification?.tag || payload.data?.tag || ("de-casa-em-casa-" + Date.now() + "-" + Math.floor(Math.random() * 10000));

    const options = {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { url }
    };

    event.waitUntil(
      self.registration.getNotifications({ tag }).then((notifications) => {
        if (!notifications || notifications.length === 0) {
          return self.registration.showNotification(title, options);
        }
      })
    );
  } catch (err) {
    console.warn('[SW] Erro ao processar push handler:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/notificacoes';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
