// App-wide offline shell (§6.2 clock-in resilience + §14.3 PWA installability).
// Registered on every page (src/components/PwaRegister.tsx); caches public,
// non-authenticated pages and static assets (stale-while-revalidate) so the
// kiosk and landing/login keep rendering offline. Never caches /api/* or
// /app/* — those are per-session, and the cache key has no concept of "whose
// session" the cached HTML belongs to. The clock stamp queue itself lives in
// IndexedDB (see src/lib/clock-queue.ts) and is replayed by the page on
// reconnect; stamps are never served from this cache.

const CACHE = "skifta-shell-v2";

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
  // Never cache authenticated app pages: they're per-session HTML keyed on a
  // cookie the cache key doesn't see, so caching by URL alone would risk
  // serving one user's page to the next user/session on a shared device.
  if (url.pathname.startsWith("/app")) return;

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
