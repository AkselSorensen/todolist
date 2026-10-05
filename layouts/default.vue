<template>
  <div class="min-h-dvh bg-dark">
    <nav ref="navRef" class="sticky top-0 z-50 bg-surface/90 backdrop-blur-lg border-b border-border pt-safe">
      <div class="max-w-6xl mx-auto px-2 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-1 sm:gap-2">
        <NuxtLink to="/" class="flex items-center gap-2 sm:gap-3 group flex-shrink-0">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon icon="lucide:heart" class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <span class="hidden sm:inline text-base sm:text-lg font-bold text-text">Nous Deux</span>
        </NuxtLink>
        <div class="flex items-center gap-0.5 sm:gap-1.5 max-[360px]:gap-0 min-w-0">
          <NuxtLink to="/todos" class="px-1.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/todos' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:list-todo" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden lg:inline">Tâches</span>
          </NuxtLink>
          <NuxtLink to="/calendrier" class="px-1.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/calendrier' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:calendar-days" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden lg:inline">Calendrier</span>
          </NuxtLink>
          <NuxtLink to="/carte" class="px-1.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/carte' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:globe" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden lg:inline">Carte</span>
          </NuxtLink>
          <NuxtLink to="/moments" class="px-1.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/moments' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:sparkles" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden lg:inline">Moments</span>
          </NuxtLink>
          <NuxtLink to="/messages" class="px-1.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/messages' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:message-circle" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden lg:inline">Chat</span>
          </NuxtLink>
          <NuxtLink to="/business-date" class="px-1.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
            :class="$route.path === '/business-date' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:briefcase" class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span class="hidden lg:inline">Business</span>
          </NuxtLink>

          <!-- Notification bell -->
          <div class="relative" ref="notifRef">
            <button @click="showNotifs = !showNotifs"
              class="relative p-2 rounded-xl hover:bg-surface2 transition-colors" aria-label="Notifications">
              <Icon icon="lucide:bell" class="w-4 h-4 sm:w-5 sm:h-5" :class="unreadCount > 0 ? 'text-gold' : 'text-text-muted'" />
              <span v-if="unreadCount > 0" class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose text-white text-[10px] font-bold flex items-center justify-center leading-none">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
            </button>

            <!-- Notif dropdown -->
            <Transition name="fade">
              <div v-if="showNotifs" class="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] flex flex-col">
                <div class="flex items-center justify-between p-3 border-b border-border">
                  <p class="text-sm font-bold">Notifications</p>
                  <button @click="markAllRead" v-if="unreadCount > 0" class="text-xs text-gold hover:text-gold-soft">Tout lu</button>
                </div>
                <div class="overflow-y-auto flex-1">
                  <div v-if="notifications.length === 0" class="text-center py-8 text-text-muted text-sm">Aucune notification</div>
                  <div v-for="n in notifications" :key="n.id"
                    @click="goToNotif(n)"
                    class="flex items-start gap-3 p-3 hover:bg-surface2 cursor-pointer transition-colors border-b border-border/50"
                    :class="n.read ? '' : 'bg-rose/5'">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" :style="{ background: (n.from_color || '#a78bfa') + '20' }">
                      {{ n.from_name?.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-text leading-snug">{{ n.message }}</p>
                      <p class="text-[11px] text-text-muted mt-1">{{ timeAgo(n.created_at) }}</p>
                    </div>
                    <span v-if="!n.read" class="w-2 h-2 rounded-full bg-rose flex-shrink-0 mt-2" />
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Enable push (iOS 16.4+ une fois installée) -->
          <button v-if="pushSupported && !pushSubscribed" @click="subscribePush"
            class="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-mint/10 text-mint border border-mint/20 hover:bg-mint/20 transition-colors flex items-center gap-1" aria-label="Activer les notifications">
            <Icon icon="lucide:bell-ring" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Notifs</span>
          </button>

          <!-- Aksel & Amandine -->
          <div class="flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1.5 flex-shrink-0">
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-white" :style="{ background: account.color }">
              {{ account.name.charAt(0) }}
            </div>
            <span class="hidden xl:inline text-sm text-text">{{ account.name }} & {{ account.partner.name }}</span>
            <Icon icon="lucide:heart" class="w-3.5 h-3.5 text-rose hidden sm:block" />
          </div>
        </div>
      </div>
    </nav>
    <main class="pb-safe">
      <slot />
    </main>

    <!-- Install banner (mobile / Android / iOS Safari) -->
    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="showInstallBanner" class="fixed bottom-0 left-0 right-0 z-[150] pb-safe">
          <div class="mx-3 mb-3 bg-surface border border-border rounded-2xl p-3.5 shadow-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center flex-shrink-0">
              <Icon icon="lucide:heart" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold">Installer Nous Deux</p>
              <p class="text-[11px] text-text-muted truncate">{{ isIOS ? 'Ajoute l’app à ton écran d’accueil' : 'Accès rapide depuis ton écran d’accueil' }}</p>
            </div>
            <button @click="openInstall"
              class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-xs font-semibold flex-shrink-0">Installer</button>
            <button @click="dismissInstall" class="p-1.5 text-text-muted flex-shrink-0" aria-label="Fermer">
              <Icon icon="lucide:x" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Install Modal (iOS instructions / Android prompt) -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showInstallModal" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showInstallModal = false" />
          <div class="relative w-full sm:max-w-xs bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl text-center pb-safe-lg">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:heart" class="w-7 h-7 text-white" />
            </div>
            <h3 class="text-lg font-bold mb-1">Installer Nous Deux</h3>
            <p v-if="isIOS" class="text-sm text-text-muted mb-5">Sur iPhone, ajoute l’app depuis Safari :</p>
            <p v-else class="text-sm text-text-muted mb-5">Ajoute l’app sur ton écran d’accueil pour un accès rapide</p>

            <!-- iOS : 3 étapes -->
            <div v-if="isIOS" class="space-y-2.5 mb-5 text-left">
              <div class="flex items-center gap-3 bg-surface2 rounded-xl p-3">
                <span class="w-6 h-6 rounded-full bg-lavender/20 text-lavender text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <p class="text-xs text-text">Appuie sur <b>Partager</b> <Icon icon="lucide:share" class="w-3 h-3 inline" /> en bas de Safari</p>
              </div>
              <div class="flex items-center gap-3 bg-surface2 rounded-xl p-3">
                <span class="w-6 h-6 rounded-full bg-lavender/20 text-lavender text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <p class="text-xs text-text">Scrolle et tape <b>Ajouter à l’écran d’accueil</b></p>
              </div>
              <div class="flex items-center gap-3 bg-surface2 rounded-xl p-3">
                <span class="w-6 h-6 rounded-full bg-lavender/20 text-lavender text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                <p class="text-xs text-text">Tape <b>Ajouter</b> en haut à droite</p>
              </div>
            </div>

            <button v-if="isIOS" @click="shareInstall"
              class="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm mb-2 flex items-center justify-center gap-2">
              <Icon icon="lucide:share" class="w-4 h-4" /> Envoyer le lien
            </button>
            <button v-else @click="installPWA"
              class="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm mb-2 flex items-center justify-center gap-2">
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

// Hardcoded — no login needed
const account = {
  id: 4, email: 'aksel@nousdeux.fr', name: 'Aksel', color: '#4da6ff',
  partnership_id: 1, partner_id: 5,
  partner: { id: 5, name: 'Amandine', color: '#ff6b8a', email: 'amandine@nousdeux.fr' }
}
const navRef = ref<HTMLElement | null>(null)
const notifRef = ref<HTMLElement | null>(null)
const showNotifs = ref(false)
const notifications = ref<any[]>([])
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const deferredPrompt = ref<any>(null)
const showInstallModal = ref(false)
const showInstallBanner = ref(false)

// Platform detection (client-only)
const isIOS = ref(false)
const isStandalone = ref(false)

async function loadNotifications() {
  try { notifications.value = await $fetch('/api/notifications') } catch { notifications.value = [] }
}

// Push notifications
const pushSupported = ref(false)
const pushSubscribed = ref(false)

onMounted(async () => {
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  isStandalone.value = (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    pushSupported.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      pushSubscribed.value = !!sub
    } catch { pushSupported.value = false }
  }
})

async function subscribePush() {
  // Web Push iOS : uniquement quand l'app est installée sur l'écran d'accueil
  if (isIOS.value && !isStandalone.value) {
    openInstall()
    return
  }
  try {
    const reg = await navigator.serviceWorker.ready
    const { publicKey } = await $fetch('/api/push-subscribe')
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })
    await $fetch('/api/push-subscribe', { method: 'POST', body: { subscription: sub } })
    pushSubscribed.value = true
  } catch (e) {
    console.log('Push subscribe failed:', e)
  }
}

function urlBase64ToUint8Array(b64: string) {
  const padding = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

async function markAllRead() {
  await $fetch('/api/notifications', { method: 'PATCH', body: { read_all: true } })
  notifications.value.forEach(n => n.read = true)
}

function goToNotif(n: any) {
  $fetch('/api/notifications', { method: 'PATCH', body: { id: n.id } })
  n.read = true
  showNotifs.value = false
  if (n.link) navigateTo(n.link)
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  return `Il y a ${Math.floor(hours / 24)}j`
}

// Close on outside click
onMounted(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduceMotion) {
    nextTick(() => {
      gsap.from(navRef.value, { autoAlpha: 0, y: -8, duration: 0.4, ease: 'power3.out', delay: 0.05 })
    })
  }

  loadNotifications()
  setInterval(loadNotifications, 60000) // poll every 60s

  document.addEventListener('click', (e) => {
    if (notifRef.value && !notifRef.value.contains(e.target as Node)) showNotifs.value = false
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
    if (!localStorage.getItem('nd-install-dismissed')) showInstallBanner.value = true
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    showInstallBanner.value = false
    showInstallModal.value = false
  })

  // iOS Safari (non installée) → propose l'installation après quelques secondes
  if (isIOS.value && !isStandalone.value && !localStorage.getItem('nd-install-dismissed')) {
    setTimeout(() => { showInstallBanner.value = true }, 3000)
  }
})

function openInstall() {
  showInstallBanner.value = false
  showInstallModal.value = true
}

function dismissInstall() {
  showInstallBanner.value = false
  try { localStorage.setItem('nd-install-dismissed', '1') } catch {}
}

async function shareInstall() {
  const url = window.location.origin + '/'
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Nous Deux', text: 'Notre app : todo, calendrier et moments partagés', url })
    } catch { /* user cancelled */ }
  } else {
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
  }
}

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
.fade-enter-active, .fade-leave-active { transition: all 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(100%); }
</style>
