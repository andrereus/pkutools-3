// Unregister the old service worker with this filename
// Keep the file for each service worker that needs to be unregistered!
self.addEventListener('install', (e) => {
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  self.registration
    .unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => {
        if (client instanceof WindowClient) client.navigate(client.url)
      })
      return Promise.resolve()
    })
    .then(() => {
      self.caches.keys().then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) => {
            return self.caches.delete(cacheName)
          })
        )
      })
    })
})
