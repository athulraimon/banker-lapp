// Minimal service worker for Banker Lapp.
//
// Its job is installability and fast repeat launches — not offline data. API
// responses are deliberately never cached: a stale leaderboard or a stale FP1
// lock state would be worse than an error message, and React Query already
// handles in-session caching.
//
// Strategy:
//   - navigations   -> network first, fall back to the cached app shell
//   - build assets  -> stale-while-revalidate (content-hashed, so safe)
//   - icons/manifest-> never cached; the install flow reads these
//   - everything else (API, Google) -> straight to the network, untouched

// Bump this whenever the cached asset set changes; `activate` deletes every
// cache that is not the current pair, which is the only way an existing client
// drops a bad entry.
const VERSION = 'v3';
const SHELL_CACHE = `banker-lapp-shell-${VERSION}`;
const ASSET_CACHE = `banker-lapp-assets-${VERSION}`;
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Only the shell. The manifest is deliberately NOT precached — see
      // isStaticAsset for why anything the install flow reads must stay
      // uncached.
      .then((cache) => cache.addAll([SHELL_URL]))
      // A failed precache must not block installation; the fetch handler will
      // populate the cache on first successful navigation instead.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// What may be served from cache.
//
// /icons/, /favicon.png and /manifest.json are deliberately excluded, even
// though they are the most obviously cacheable files here. They are what the
// browser reads to mint the installed app's launcher icon and splash screen,
// and unlike /_expo/ and /assets/ they carry no content hash in their names — so
// one cached copy pins the home-screen icon to an old build. It survives
// uninstalling the app too, because Cache Storage belongs to the origin and
// outlives the installed PWA, which makes it look unfixable from the phone.
// Costing a few KB of network on those is worth far more than that.
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|woff2?|ttf)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin traffic: that is the API and Google's OAuth
  // endpoints, where caching or an opaque response would break auth.
  if (url.origin !== self.location.origin) return;

  // App shell for navigations. Network first so a deploy is picked up promptly,
  // cache as the fallback so a cold launch with no signal still opens.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          // Serve the cached copy immediately when we have one and refresh in
          // the background; otherwise wait for the network.
          return cached || network;
        })
      )
    );
  }
});
