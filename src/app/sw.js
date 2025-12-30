
const CACHE_NAME = 'de-casa-em-casa-cache-v1';
const FALLBACK_HTML_URL = '/offline.html';

// Recursos essenciais para o App Shell
const urlsToCache = [
  '/',
  FALLBACK_HTML_URL,
  '/images/Logo_v3.png',
  // Adicione aqui outros recursos estáticos críticos se houver
];

// Instala o Service Worker e cacheia o App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache aberto. Cacheando App Shell.');
      return cache.addAll(urlsToCache);
    }).catch(err => {
      console.error('[SW] Falha ao cachear App Shell:', err);
    })
  );
});

// Limpa caches antigos na ativação
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('[SW] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  return self.clients.claim();
});


// Estratégia de cache: Stale-While-Revalidate para requisições de navegação
const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
};

// Estratégia de cache: Cache-First para recursos estáticos
const cacheFirst = async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error(`[SW] Falha ao buscar recurso da rede: ${request.url}`, error);
        // Não retorna nada para que o navegador lide com o erro de imagem/recurso quebrado
        // em vez do Service Worker quebrar a página inteira.
        return new Response('', {status: 503, statusText: 'Service Unavailable'});
    }
};


self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora requisições que não são GET (ex: POST para a API)
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignora requisições para o Firebase e extensões do Chrome
  if (request.url.includes('firestore.googleapis.com') || request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  const destination = request.destination;

  if (request.mode === 'navigate') {
    // É uma navegação de página. Tenta a rede primeiro, depois o cache, e por último o fallback.
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          // Se a resposta da rede for bem-sucedida, atualiza o cache
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          // A rede falhou, tenta o cache
          console.log('[SW] Rede falhou. Tentando cache para:', request.url);
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se não estiver no cache, retorna a página de fallback
          console.log('[SW] Cache miss. Retornando fallback offline.');
          const fallbackResponse = await caches.match(FALLBACK_HTML_URL);
          if (fallbackResponse) {
            return fallbackResponse;
          }
          // Fallback final se até a página offline falhar
          return new Response("Você está offline e não foi possível carregar o conteúdo.", { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
  } else if (['style', 'script', 'worker', 'font', 'image'].includes(destination)) {
    // É um recurso estático. Usa Cache-First.
    event.respondWith(cacheFirst(request));
  } else {
    // Para outros tipos de requisição, apenas passa adiante
    return;
  }
});
