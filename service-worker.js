const APP_CACHE = 'ctlp-app-shell-v1';
const ASSET_CACHE = 'ctlp-public-assets-v1';
const APP_ROOT = new URL('./', self.registration.scope).href;
const PUBLIC_HOSTS = new Set(['esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(APP_CACHE);
    await Promise.allSettled([
      shell.add(new Request(APP_ROOT, { cache: 'reload' })),
      caches.open(ASSET_CACHE).then(cache => cache.add('https://esm.sh/@supabase/supabase-js@2'))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ctlp-') && ![APP_CACHE, ASSET_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match(APP_ROOT)) || Response.error();
      }
    })());
    return;
  }

  if (PUBLIC_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
        return response;
      } catch (_) { return cached || Response.error(); }
    })());
  }
});
