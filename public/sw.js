const CACHE = 'nousdeux-v3'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (e) => {
  self.clients.claim()
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
})

// Push notifications
self.addEventListener('push', (e) => {
  if (!e.data) return
  try {
    const data = e.data.json()
    e.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icons/icon.svg',
        badge: '/icons/icon.svg',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' },
        actions: data.actions || []
      })
    )
  } catch { /* ignore malformed push */ }
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus()
      }
      return clients.openWindow(e.notification.data?.url || '/')
    })
  )
})

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/')) return
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.type === 'basic') {
            const clone = res.clone()
            caches.open(CACHE).then(cache => cache.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }
})
