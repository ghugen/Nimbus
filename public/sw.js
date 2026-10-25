const CACHE = "nimbus-static-v1";
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/offline.html", "/favicon.svg", "/icon-maskable.svg"]),
      ),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("nimbus-static-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  ),
);
// Nunca armazenar APIs, HTML autenticado, anotações ou arquivos adquiridos no cache compartilhado.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
});
