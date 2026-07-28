import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: [],
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'vercel'
  },
  vite: {
    plugins: [tailwindcss()]
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    public: {
      appName: 'Nous Deux'
    }
  },
  app: {
    head: {
      title: 'Nous Deux — Aksel & Amandine',
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
