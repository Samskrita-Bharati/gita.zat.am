// Offline caching was removed because cached public game HTML bypassed
// the new client-side login gate. This update evicts the legacy cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.delete("gita_typing_game").then(() => self.clients.claim()),
  );
});
