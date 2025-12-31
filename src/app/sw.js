const CACHE_NAME = 'de-casa-em-casa-cache-v2'; // Versão do cache atualizada
const OFFLINE_ASSETS = [
  '/',
  '/manifest.json',
  '/images/Logo_v3.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Instalação: Cacheia os ativos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando arquivos estáticos do App Shell.');
      return cache.addAll(OFFLINE_ASSETS);
    }).catch(err => {
      console.error("[SW] Falha ao cachear App Shell:", err);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos para evitar conflitos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log(`[SW] Deletando cache antigo: ${key}`);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia de busca (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora requisições que não são GET ou que não são para http/https
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Ignora chamadas do Firebase e extensões do Chrome
  if (
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('firebasestorage.googleapis.com') ||
    request.url.includes('firebaseio.com') ||
    request.url.startsWith('chrome-extension://')
  ) {
    return;
  }

  // Estratégia Stale-While-Revalidate para navegação e recursos
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Tenta responder com o cache primeiro (rápido, para offline)
      const cachedResponse = await cache.match(request);
      
      // 2. Em paralelo, busca na rede para atualizar o cache
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Se a requisição for bem-sucedida, atualiza o cache com a nova versão
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // A busca na rede falhou (provavelmente offline), mas não é um problema
        // se já tivermos uma resposta do cache.
        return null;
      });

      // Retorna a resposta do cache se existir, caso contrário, aguarda a resposta da rede.
      // Isso garante que o app funcione offline (com dados em cache) e também online.
      return cachedResponse || await fetchPromise;
    })
  );
});