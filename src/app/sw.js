
const CACHE_NAME = 'de-casa-em-casa-cache-v1';
const FALLBACK_HTML_URL = '/offline.html';

// Lista de recursos a serem cacheados na instalação
const urlsToCache = [
  '/',
  FALLBACK_HTML_URL,
  '/images/Logo_v3.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aberto. Adicionando URLs ao cache...');
      return cache.addAll(urlsToCache);
    }).catch(err => {
      console.error('Falha ao abrir o cache ou adicionar URLs:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora completamente requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignora requisições para o Firebase e extensões do Chrome
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Estratégia de cache-first para navegação
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          // Tenta buscar da rede primeiro
          const networkResponse = await fetch(event.request);
          // Se bem-sucedido, clona a resposta e armazena no cache
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          // Se a rede falhar, tenta buscar do cache
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se não estiver no cache, retorna a página de fallback
          return await cache.match(FALLBACK_HTML_URL);
        }
      })
    );
    return;
  }

  // Estratégia de cache-first para outros recursos (CSS, JS, Imagens)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retorna do cache se encontrado
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Se não estiver no cache, busca na rede
      return fetch(event.request).then((networkResponse) => {
        // Clona e armazena a resposta bem-sucedida no cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
