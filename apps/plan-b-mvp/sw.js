/* Reroute service worker: offline app shell, network-first API reads, and Web Push notifications. */
"use strict";

const VERSION = "planb-reroute-23"; // keep the planb- prefix: activate() deletes older planb- caches
// The React shell's hashed files (/assets/*) are found by reading the cached "/" page and the entry script, see precacheBuilt().
// Legacy scripts are listed because the shell loads them as classic scripts; the old gsap layer (legacy index.html only) is cached on first use only.
const SHELL = ["/", "/app.css", "/app.js", "/offline.js", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];
const ASSET = /\/?assets\/[A-Za-z0-9._-]+\.(?:js|css)|(?<=["']\.\/)[A-Za-z0-9._-]+\.(?:js|css)(?=["'])/g; // "/assets/x.js" in the page, "./x.js" between chunks

async function precacheBuilt(cache) {
  const html = await cache.match("/");
  const seen = new Set();
  const scan = async (text) => {
    for (const match of text.matchAll(ASSET)) {
      const url = match[0].includes("assets/") ? "/" + match[0].replace(/^\//, "") : "/assets/" + match[0];
      if (seen.has(url)) continue;
      seen.add(url);
      await cache.add(url).catch(() => {});
      // Entry chunks list their lazy chunks as "assets/x.js" strings (Vite's preload map), so scan scripts one level further.
      if (url.endsWith(".js")) { const copy = await cache.match(url); if (copy) await scan(await copy.clone().text()); }
    }
  };
  if (html) await scan(await html.clone().text());
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then(async (cache) => {
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await precacheBuilt(cache).catch(() => {});
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("planb-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// App shell: cache-first, refreshed in the background so the next visit has the newest files.
// API reads (GET /api/*, /qr.svg): network-first, falling back to the last good copy when offline.
// POSTs, other origins (maps, fonts) and the service worker itself are left to the browser and are never cached.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  // Sign-in, the signed-in user and their data are per person and must never come from a cache.
  if (url.pathname.startsWith("/auth/") || url.pathname === "/api/me" || url.pathname.startsWith("/api/account/") || url.pathname === "/account/delete" || url.pathname.startsWith("/.well-known/")) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/qr.svg") {
    // Offline area downloads are large and are stored by the app itself (IndexedDB), so they are not copied into this cache too.
    if (url.pathname.startsWith("/api/push/") || url.pathname.startsWith("/api/rides") || url.pathname.startsWith("/api/offline/")) return;
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req, url));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (error) {
    const hit = await cache.match(req);
    // No saved copy either: answer like the server would, marked offline, instead of an uncaught network error.
    if (!hit) return new Response(JSON.stringify({ error: "You're offline, and there is no saved copy of this information." }), { status: 503, headers: { "Content-Type": "application/json", "X-Reroute-Offline": "1" } });
    // Marked so the app knows this answer is a saved copy and the network is down (it then offers offline maps).
    const headers = new Headers(hit.headers);
    headers.set("X-Reroute-Offline", "1");
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  }
}

async function cacheFirst(req, url) {
  const cache = await caches.open(VERSION);
  const key = req.mode === "navigate" ? "/" : req;
  const hit = await cache.match(key, { ignoreSearch: true });
  const refresh = fetch(req).then((res) => { if (res.ok && (req.mode !== "navigate" || url.pathname === "/")) cache.put(key, res.clone()); return res; }).catch(() => null);
  if (hit) { refresh.catch(() => {}); return hit; }
  return (await refresh) || new Response("Reroute is offline and this page has not been saved yet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Reroute";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "There is a disruption on your trip. Open Reroute for alternatives.",
    tag: data.tag || "planb",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/", simulated: !!data.simulated },
    renotify: true,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      open.postMessage({ type: "open", url: target });
    } else await self.clients.openWindow(target);
  })());
});
