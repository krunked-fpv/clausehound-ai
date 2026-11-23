/**
 * ClauseHound Local — Subpath-Safe Offline Service Worker
 * Resolves all precached assets relative to `self.registration.scope`.
 */

const PWA_CACHE_VERSION = "clausehound-faraday-v1";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./src/ui/desk-theme.css",
  "./src/vault/cookie-vault.js",
  "./src/vault/local-sync.js",
  "./src/security/faraday-airgap.js",
  "./src/engine/clause-rules.js",
  "./src/engine/specimens.js",
  "./src/engine/clause-scanner.js",
  "./src/engine/redline-engine.js",
  "./src/engine/webllm-bridge.js",
  "./src/audio/faraday-audio.js",
  "./src/share/receipt-codec.js",
  "./src/canvas/seal-renderer.js",
  "./src/pwa/sw-register.js",
  "./src/ui/app-shell.js",
  "./src/ui/command-rail.js",
  "./src/ui/telemetry-strip.js",
  "./src/ui/clause-workbench.js",
  "./src/ui/specimen-drawer.js",
  "./src/ui/vault-modal.js",
  "./src/ui/receipt-modal.js"
];

function getScopeBaseUrl() {
  return (self.registration && self.registration.scope) || (self.location && self.location.href) || "./";
}

function resolvePrecacheUrls() {
  const scopeBase = getScopeBaseUrl();
  return PRECACHE_ASSETS.map((relPath) => new URL(relPath, scopeBase).href);
}

async function lookupCachedResponse(request) {
  const cache = await caches.open(PWA_CACHE_VERSION);
  const exact = await cache.match(request);
  if (exact) return exact;

  const globalMatch = await caches.match(request);
  if (globalMatch) return globalMatch;

  const ignoreSearch = await cache.match(request, { ignoreSearch: true });
  if (ignoreSearch) return ignoreSearch;

  if (request.mode === "navigate") {
    const scopeBase = getScopeBaseUrl();
    const indexFallback = await cache.match(new URL("./index.html", scopeBase).href);
    if (indexFallback) return indexFallback;
    const rootFallback = await cache.match(new URL("./", scopeBase).href);
    if (rootFallback) return rootFallback;
  }

  return null;
}

function createOfflineFallbackResponse() {
  return new Response("ClauseHound Local offline cache miss.", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function handleSameOriginGet(request) {
  const isOffline = self.navigator && self.navigator.onLine === false;
  if (isOffline) {
    const cached = await lookupCachedResponse(request);
    return cached || createOfflineFallbackResponse();
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok && (networkResponse.type === "basic" || networkResponse.type === "default")) {
      const cache = await caches.open(PWA_CACHE_VERSION);
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    if (networkResponse && networkResponse.status < 500) {
      return networkResponse;
    }

    const fallback = await lookupCachedResponse(request);
    return fallback || networkResponse;
  } catch {
    const cached = await lookupCachedResponse(request);
    return cached || createOfflineFallbackResponse();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PWA_CACHE_VERSION);
      await cache.addAll(resolvePrecacheUrls());
      if (typeof self.skipWaiting === "function") {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== PWA_CACHE_VERSION)
          .map((staleName) => caches.delete(staleName))
      );
      if (self.clients && typeof self.clients.claim === "function") {
        await self.clients.claim();
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!request || request.method !== "GET") return;

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return;
  }

  if (!self.location || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(handleSameOriginGet(request));
});
