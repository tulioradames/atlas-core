// Atlas - Service Worker do shell PWA.
//
// A identificacao da versao vem de UM lugar so: o parametro ?v= usado no
// registro do Service Worker (em js/v2.js). O nome do cache e as URLs do
// pre-cache sao derivados dele, o que elimina a fonte mais comum de "publiquei
// mas continua igual": nome de cache antigo ficando para tras, ou pre-cache
// apontando para uma URL sem a querystring de versao (e portanto nunca usado,
// porque a Cache API compara a URL completa, incluindo a querystring).
//
// Para publicar uma versao nova basta alterar ATLAS_BUILD em js/v2.js e a mesma
// string nas querystrings do index.html. tests/static-audit.cjs falha se as duas
// deixarem de bater.
const ATLAS_BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const ATLAS_CACHE = `atlas-v2-shell-${ATLAS_BUILD}`;

// Arquivos versionados: acompanham a querystring, igual ao index.html.
const ATLAS_VERSIONED = [
  `./css/v2.css?v=${ATLAS_BUILD}`,
  `./js/v2.js?v=${ATLAS_BUILD}`,
  `./config/config.js?v=${ATLAS_BUILD}`,
];

// Arquivos estaveis: nao mudam entre versoes do Atlas.
const ATLAS_STATIC = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/vendor/lucide.min.js',
  './assets/vendor/supabase.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

const ATLAS_SHELL = [...ATLAS_STATIC, ...ATLAS_VERSIONED];

// Codigo proprio do Atlas: precisa aparecer atualizado ja no primeiro
// carregamento depois de uma publicacao. Por isso vai por rede primeiro, com o
// cache apenas como reserva para uso offline.
const APP_CODE_PATTERN = /\/(?:css\/v2\.css|js\/v2\.js|config\/config\.js)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ATLAS_CACHE).then((cache) => Promise.allSettled(
      // allSettled: um arquivo indisponivel no momento da instalacao nao deve
      // impedir o Service Worker de instalar (comportamento do addAll).
      ATLAS_SHELL.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))),
    )),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('atlas-v2-') && key !== ATLAS_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        // Avisar as abas abertas que um Service Worker novo assumiu o controle.
        // Elas continuam executando o JavaScript antigo em memoria; o aviso
        // permite que a interface ofereca recarregar em vez de ficar em um
        // estado misto e silencioso.
        clients.forEach((client) => client.postMessage({ type: 'atlas-sw-activated', build: ATLAS_BUILD }));
      }),
  );
});

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    const update = fetch(request)
      .then((response) => {
        if (response.ok) caches.open(ATLAS_CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(() => cached);
    return cached || update;
  });
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(ATLAS_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || Promise.reject(new Error('Recurso indisponivel offline.'))));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isStatic = /\.(?:css|js|png|ico|webmanifest)$/.test(url.pathname);

  if (isNavigation) {
    event.respondWith(
      // cache: 'no-store' evita que o cache HTTP do navegador (ou um header
      // permissivo vindo do CDN) devolva um index.html antigo. As meta tags
      // http-equiv de Cache-Control no HTML nao tem efeito nesta decisao.
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ATLAS_CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  if (isStatic) {
    event.respondWith(APP_CODE_PATTERN.test(url.pathname) ? networkFirst(request) : cacheFirst(request));
  }
});
