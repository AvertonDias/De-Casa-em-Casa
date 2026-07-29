// Service Worker principal para PWA e Notificações Push do aplicativo De Casa em Casa

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const CACHE_NAME = 'de-casa-em-casa-cache-v5';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/offline.html',
  '/images/Logo_v3.png',
  '/images/De casa em casa pb.png',
  '/favicon.ico'
];

// 1. Configuração do Firebase Cloud Messaging para segundo plano
const firebaseConfig = {
  projectId: "appterritorios-e5bb5",
  appId: "1:83629039662:web:42d410f411b2e9b33fffbf",
  apiKey: "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  messagingSenderId: "83629039662",
  storageBucket: "appterritorios-e5bb5.appspot.com",
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Mensagem FCM recebida em segundo plano:", payload);

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

// 2. Ciclo de Vida do Service Worker e Caching para Conexões Lentas/Instáveis

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-carregando assets estáticos essenciais');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Falha ao pré-carregar alguns assets:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estratégia de Fetch Interceptado (Network-first para navegação, Stale-while-revalidate para recursos)

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorar requisições não GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorar requisições para o Firebase / Google API / Chrome Extensions
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.hostname.includes('fcmregistrations.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Para navegação de páginas (HTML): Estratégia Network First com Fallback para Cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SW] Falha de rede para navegação. Tentando cache offline...');
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const dashboardCache = await caches.match('/dashboard');
          if (dashboardCache) {
            return dashboardCache;
          }
          const rootCache = await caches.match('/');
          if (rootCache) {
            return rootCache;
          }
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // Para assets estáticos (JS, CSS, Imagens, Fontes): Estratégia Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});
