const CACHE = 'nousdeux-v4'
const OFFLINE_URL = '/'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([OFFLINE_URL, '/manifest.json'])).catch(() => {})
  )
})

self.addEventListener('activate', (e) => {
  self.clients.claim()
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && !k.startsWith('cdn-')).map(k => caches.delete(k)))
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
        icon: data.icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
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
        .catch(() =>
          // Navigation request offline → fallback to cached home
          (e.request.mode === 'navigate'
            ? caches.match(OFFLINE_URL)
            : caches.match(e.request))
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }
})
