const CACHE = 'nousdeux-v2'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (e) => {
  self.clients.claim()
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
})

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  // Only cache GET requests — POST/PATCH/DELETE passthrough
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)
  // API calls: network-first, no cache
  if (url.pathname.startsWith('/api/')) return

  // Same-origin assets: network-first
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
