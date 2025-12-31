const CACHE_NAME = 'de-casa-em-casa-cache-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/Logo_v3.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Instalação: Cacheia o "App Shell" imediatamente
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando arquivos estáticos');
      return cache.addAll(OFFLINE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa versões antigas do app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estratégia de busca (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora chamadas do Firebase (ele tem cache próprio via SDK) e Chrome Extensions
  if (
    request.url.includes('firestore.googleapis.com') || 
    request.url.includes('firebasedatabase.app') ||
    request.url.startsWith('chrome-extension://')
  ) {
    return;
  }

  // Estratégia para Navegação (Páginas HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // Se a rede falhar, tenta o cache. Se não houver cache, tenta a rota raiz '/'
        return caches.match(request).then(response => {
          return response || caches.match('/');
        });
      })
    );
    return;
  }

  // Estratégia para Recursos (JS, CSS, Imagens) - Stale-While-Revalidate
  // Serve do cache rápido, mas atualiza o cache em segundo plano se houver rede
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cacheCopy));
        }
        return networkResponse;
      }).catch(() => null); // Falha silenciosa se estiver offline

      return cachedResponse || fetchPromise;
    })
  );
});