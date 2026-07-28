<template>
  <div class="min-h-screen bg-dark">
    <nav ref="navRef" class="sticky top-0 z-50 bg-surface/90 backdrop-blur-lg border-b border-border opacity-0">
      <div class="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 sm:gap-3 group">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon icon="lucide:heart" class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <span class="text-base sm:text-lg font-bold text-text">Nous Deux</span>
        </NuxtLink>
        <div class="flex items-center gap-1 sm:gap-2">
          <button v-if="deferredPrompt" @click="showInstallModal = true"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose to-lavender text-white text-[10px] sm:text-xs font-semibold hover:scale-105 transition-transform flex items-center gap-1">
            <Icon icon="lucide:download" class="w-3 h-3" /> <span class="hidden sm:inline">Installer</span>
          </button>
          <NuxtLink to="/todos" class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/todos' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:list-todo" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden xs:inline">Tâches</span>
          </NuxtLink>
          <NuxtLink to="/calendrier" class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/calendrier' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:calendar-days" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden xs:inline">Calendrier</span>
          </NuxtLink>
          <NuxtLink to="/carte" class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/carte' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:globe" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden xs:inline">Carte</span>
          </NuxtLink>
        </div>
      </div>
    </nav>
    <main>
      <slot />
    </main>

    <!-- PWA Install Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showInstallModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showInstallModal = false" />
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-xs p-6 shadow-2xl text-center">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:heart" class="w-7 h-7 text-white" />
            </div>
            <h3 class="text-lg font-bold mb-1">Installer Nous Deux</h3>
            <p class="text-sm text-text-muted mb-5">Ajoute l'app sur ton écran d'accueil pour un accès rapide</p>
            <button @click="installPWA"
              class="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform mb-2 flex items-center justify-center gap-2">
              <Icon icon="lucide:download" class="w-4 h-4" /> Installer
            </button>
            <button @click="showInstallModal = false"
              class="w-full py-2 rounded-xl text-text-muted text-sm hover:bg-surface2 transition-colors">Plus tard</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { gsap } from 'gsap'

const navRef = ref<HTMLElement | null>(null)
const deferredPrompt = ref<any>(null)
const showInstallModal = ref(false)

onMounted(() => {
  nextTick(() => {
    gsap.to(navRef.value, { autoAlpha: 1, duration: 0.5, ease: 'power3.out', delay: 0.1 })
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    showInstallModal.value = false
  })
})

async function installPWA() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const result = await deferredPrompt.value.userChoice
  if (result.outcome === 'accepted') deferredPrompt.value = null
  showInstallModal.value = false
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.92) translateY(10px); }
</style>
