/*
 * Service Worker - Asisten Pribadi Siswa
 *
 * Strategi:
 * - Navigasi & file kode (JS/CSS/JSON): network-first dengan fallback cache.
 *   Perubahan kode langsung diambil saat online, tidak tersangkut cache lama.
 * - Gambar/font: stale-while-revalidate. Tampil instan, diperbarui di latar.
 * - Cache diberi versi dan cache lama dibersihkan saat activate.
 *
 * Menambah modul cukup lewat js/modules/modules.json. SW membaca manifest
 * tersebut saat install dan mem-precache entry modul secara otomatis.
 */
const CACHE_PREFIX = 'asisten-pribadi-siswa-';
const CACHE_NAME = `${CACHE_PREFIX}static-v1.6.0`;
const BASE_URL = new URL('./', self.location.href);
const INDEX_URL = new URL('index.html', BASE_URL).href;
const BASE_PATH = BASE_URL.pathname;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './styles/views.css',
  './styles/charts.css',
  './styles/overlays.css',
  './styles/native.css',
  './styles/tailwind.css',
  './js/main.js',
  './js/app/shell.js',
  './js/views/home.js',
  './js/views/module-list.js',
  './js/views/search.js',
  './js/views/settings.js',
  './js/core/bus.js',
  './js/core/chart.js',
  './js/core/config.js',
  './js/core/db.js',
  './js/core/dom.js',
  './js/core/events.js',
  './js/core/icons.js',
  './js/core/notifications.js',
  './js/core/persistence.js',
  './js/core/pwa.js',
  './js/core/registry.js',
  './js/core/router.js',
  './js/core/theme.js',
  './js/core/ui.js',
  './js/core/utils.js',
  './js/modules/modules.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

const OFFLINE_HTML = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#06100b"><title>Offline · Asisten Pribadi Siswa</title>
<style>
  :root{color-scheme:dark;--page:#06100b;--card:#0d1b13;--text:#f2f7f3;--muted:#8aa394;--border:rgba(148,184,163,.16)}
  :root[data-theme="light"]{color-scheme:light;--page:#f4f8f5;--card:#ffffff;--text:#0d1b13;--muted:#5b7268;--border:rgba(13,27,19,.12)}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px;background:var(--page);color:var(--text);font-family:system-ui,sans-serif;text-align:center}
  main{max-width:420px;padding:28px;border:1px solid var(--border);border-radius:24px;background:var(--card)}
  .mark{width:54px;height:54px;margin:0 auto 18px;border-radius:16px;background:linear-gradient(145deg,#86efac,#22c55e);color:#04130c;display:grid;place-items:center;font-size:26px}
  h1{margin:0 0 10px;font-size:21px;letter-spacing:-.03em}p{margin:0 0 20px;color:var(--muted);font-size:13px;line-height:1.6}
  button{padding:11px 17px;border:0;border-radius:12px;background:#4ade80;color:#04130c;font:inherit;font-weight:700;cursor:pointer}
</style>
<script>
  (() => {
    try {
      const stored = localStorage.getItem('asisten.theme');
      const mode = stored === 'light' || stored === 'dark' ? stored : 'system';
      const dark = mode === 'dark'
        || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#06100b' : '#f4f8f5');
    } catch {
      document.documentElement.dataset.theme = 'dark';
    }
  })();
</script>
</head>
<body><main><div class="mark">✦</div><h1>Belum siap offline</h1>
<p>Halaman ini belum tersimpan di perangkat. Sambungkan internet sekali lagi untuk menyiapkan aplikasi.</p>
<button type="button" onclick="location.reload()">Coba lagi</button></main></body></html>`;

function absolute(path) {
  return new URL(path, BASE_URL).href;
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isInScope(url) {
  return isSameOrigin(url) && url.pathname.startsWith(BASE_PATH);
}

function isCacheable(response) {
  return response && response.ok && response.status === 200;
}

async function cacheSafely(cache, request, response) {
  if (!isCacheable(response)) return;
  try {
    await cache.put(request, response);
  } catch (error) {
    console.warn('[SW] Gagal menyimpan aset.', request.url, error);
  }
}

async function fetchWithTimeout(request, timeout = 4200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // `no-cache` memaksa revalidasi HTTP. Tanpa ini, host yang mengirim
    // max-age panjang bisa membuat network-first tetap menerima kode lama.
    return await fetch(request, { signal: controller.signal, cache: 'no-cache' });
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });

  try {
    const response = await fetchWithTimeout(request);
    if (isCacheable(response)) {
      event.waitUntil(cacheSafely(cache, request, response.clone()));
      return response;
    }
    if (cached) return cached;
    return response;
  } catch (error) {
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const index = await cache.match(INDEX_URL);
      if (index) return index;
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return Response.error();
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        event.waitUntil(cacheSafely(cache, request, response.clone()));
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const response = await networkPromise;
  return response ?? Response.error();
}

async function readModuleManifest() {
  try {
    const manifestUrl = absolute('js/modules/modules.json');
    const response = await fetch(new Request(manifestUrl, { cache: 'reload' }));
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('[SW] Manifest modul tidak bisa dibaca saat precache.', error);
    return null;
  }
}

function moduleAssetUrls(manifest) {
  if (!manifest || !Array.isArray(manifest.modules)) return [];
  const manifestUrl = absolute('js/modules/modules.json');
  const urls = new Set();

  for (const entry of manifest.modules) {
    if (!entry || entry.enabled === false) continue;

    if (typeof entry.entry === 'string') {
      try {
        const url = new URL(entry.entry, manifestUrl);
        if (isInScope(url)) urls.add(url.href);
      } catch {
        // Abaikan entry yang tidak valid; registry akan melaporkannya.
      }
    }

    if (Array.isArray(entry.assets)) {
      for (const asset of entry.assets) {
        if (typeof asset !== 'string') continue;
        try {
          const url = new URL(asset, manifestUrl);
          if (isInScope(url)) urls.add(url.href);
        } catch {
          // Abaikan aset yang tidak valid.
        }
      }
    }
  }

  return [...urls];
}

async function precacheModuleAssets(cache) {
  const manifest = await readModuleManifest();
  const urls = moduleAssetUrls(manifest);
  await Promise.allSettled(urls.map(async (url) => {
    try {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (isCacheable(response)) {
        await cache.put(new Request(url), response);
      }
    } catch (error) {
      console.warn('[SW] Gagal precache aset modul.', url, error);
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS.map(absolute));
    await precacheModuleAssets(cache);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const urls = data.urls
        .slice(0, 100)
        .filter((value) => typeof value === 'string')
        .map((value) => {
          try {
            return new URL(value, BASE_URL);
          } catch {
            return null;
          }
        })
        .filter((url) => url && isInScope(url));

      await Promise.allSettled(urls.map(async (url) => {
        try {
          const request = new Request(url.href, { cache: 'reload' });
          const response = await fetch(request);
          if (isCacheable(response)) {
            await cache.put(new Request(url.href), response);
          }
        } catch (error) {
          console.warn('[SW] Gagal menyimpan aset dari pesan halaman.', url.href, error);
        }
      }));
    })());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let target;
  try {
    target = new URL(event.notification.data?.url ?? './#/modul/tugas', BASE_URL);
  } catch {
    target = new URL('#/modul/tugas', BASE_URL);
  }
  if (!isInScope(target)) target = new URL('#/modul/tugas', BASE_URL);

  event.waitUntil((async () => {
    if (!self.clients?.matchAll) {
      if (self.clients?.openWindow) await self.clients.openWindow(target.href);
      return;
    }

    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      try {
        if ('navigate' in client) await client.navigate(target.href);
        else if ('postMessage' in client) {
          client.postMessage({ type: 'OPEN_URL', url: target.href });
        }
        await client.focus();
        return;
      } catch {
        // Coba jendela lain; jangan gagalkan seluruh handler.
      }
    }

    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!isSameOrigin(url)) return;
  if (request.headers.has('range')) return;

  const destination = request.destination;
  const isCode = request.mode === 'navigate'
    || destination === 'document'
    || destination === 'script'
    || destination === 'style'
    || destination === 'worker'
    || destination === 'manifest'
    || url.pathname.endsWith('.json');

  event.respondWith(
    isCode ? networkFirst(request, event) : staleWhileRevalidate(request, event),
  );
});
