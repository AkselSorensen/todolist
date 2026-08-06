import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: [],
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'vercel',
    externals: ['web-push']
  },
  vite: {
    plugins: [tailwindcss()]
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BOLCovKvfjnixTUZsfYPEVT2wdzCP7VvdZyir79G6VLG3pyV_G7WgfBf_0TYEFZoJlAdKGQBhEeMTaNEMRqt28Q',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || 'Acus0oigoQYEdfsStYxOCGwFuKMdvuScgVSBANSgD7g',
    public: {
      appName: 'Nous Deux'
    }
  },
  app: {
    head: {
      title: 'Nous Deux',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f0f14' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Nous Deux' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/icon.svg' },
        { rel: 'manifest', href: '/manifest.json' },
      ]
    }
  }
})
