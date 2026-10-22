/* Reroute service worker: offline app shell, network-first API reads, and Web Push notifications. */
"use strict";

const VERSION = "planb-reroute-2"; // keep the planb- prefix: activate() deletes older planb- caches
const SHELL = ["/", "/app.css", "/app.js", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()));
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
  if (url.pathname.startsWith("/api/") || url.pathname === "/qr.svg") {
    if (url.pathname.startsWith("/api/push/") || url.pathname.startsWith("/api/rides")) return;
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
    if (hit) return hit;
    throw error;
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
