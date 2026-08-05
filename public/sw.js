// Service Worker principal para PWA e Notificações Push do aplicativo De Casa em Casa

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const CACHE_NAME = 'de-casa-em-casa-cache-v6';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/dashboard/meus-territorios',
  '/dashboard/notificacoes',
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

console.log('✅ [SW] Service Worker principal inicializado com sucesso.');
console.log('📡 [SW FCM] Conexão ativa com Firebase Cloud Messaging (FCM) para escutar push da Vercel em segundo plano.');

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
  const targetUrl = '/dashboard/notificacoes';

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

  // Para assets imutáveis do Next.js (JS/CSS compilados em /_next/static/): Estratégia Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Para navegação de páginas (HTML): Estratégia Network First com Timeout de 3s (Otimizado para redes lentas/instáveis)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      new Promise((resolve) => {
        let isResolved = false;

        // Timeout de 3 segundos para conexões muito lentas: entrega do cache imediatamente se a rede demorar
        const timeoutId = setTimeout(async () => {
          if (!isResolved) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              console.log('[SW] Conexão lenta detectada (>3s). Entregando resposta do cache:', url.pathname);
              isResolved = true;
              resolve(cachedResponse);
            }
          }
        }, 3000);

        fetch(request)
          .then((networkResponse) => {
            clearTimeout(timeoutId);
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            if (!isResolved) {
              isResolved = true;
              resolve(networkResponse);
            }
          })
          .catch(async () => {
            clearTimeout(timeoutId);
            if (!isResolved) {
              isResolved = true;
              console.log('[SW] Falha de rede para navegação. Buscando no cache offline...');
              const cachedResponse = await caches.match(request);
              if (cachedResponse) return resolve(cachedResponse);

              const dashboardCache = await caches.match('/dashboard');
              if (dashboardCache) return resolve(dashboardCache);

              const rootCache = await caches.match('/');
              if (rootCache) return resolve(rootCache);

              const offlinePage = await caches.match('/offline.html');
              resolve(offlinePage || new Response('Offline', { status: 503, statusText: 'Offline' }));
            }
          });
      })
    );
    return;
  }

  // Para outros assets estáticos (Imagens, Ícones, Fontes): Estratégia Stale-While-Revalidate
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
