// Service worker mínimo: só guarda em cache arquivos estáticos (ícones, fontes, JS/CSS com hash).
// Páginas, chamadas ao servidor e ao Supabase NUNCA passam pelo cache, para não mostrar dados
// desatualizados nem conteúdo de usuário logado.
const CACHE = "spin-static-v1";
const PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const isStatic = url.pathname.startsWith("/assets/") || PRECACHE.includes(url.pathname);
  if (!isStatic) return; // navegação e API: sempre rede
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
