const CACHE = "miniai-shell-v2-8";
const SHELL = ["/", "/index.html", "/style.css?v=20261116images3", "/script.js?v=20261116images3", "/manifest.webmanifest", "/assets/miniai-192.png", "/assets/miniai-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Always check the deployed version first. The previous cache-first strategy
  // could keep old CSS and JavaScript forever after a website update.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response.ok) {
        const cacheKey = request.mode === "navigate" ? "/index.html" : request;
        await cache.put(cacheKey, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request) || (request.mode === "navigate" ? await caches.match("/index.html") : null);
      return cached || new Response("MiniAI is offline. Reconnect to load the latest page.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
