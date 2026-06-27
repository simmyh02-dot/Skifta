// Clock-in service worker (§6.2). Its job is to keep the kiosk usable when the
// network drops: it runtime-caches the page shell and static assets so a kiosk
// that has loaded once keeps rendering offline. The actual stamp queue lives in
// IndexedDB (see src/lib/clock-queue.ts) and is replayed by the page on
// reconnect; clock-in stamps are never served from cache.
//
// Note: a full cold-start PWA install is part of §14.3; this SW is the offline
// resilience layer the clock section needs, reused later by the PWA work.

const CACHE = "skifta-clock-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache stamp POSTs

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Don't cache API responses — clock data must always be live.
  if (url.pathname.startsWith("/api/")) return;

  // Stale-while-revalidate: serve cache fast, refresh in the background.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
