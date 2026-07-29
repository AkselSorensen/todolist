<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

definePageMeta({ layout: 'default' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }]
})

const { fetchTodos, fetchEvents, fetchUsers, createTodo, createEvent, setupDb } = useApi()
const { account } = useAuth()

const subtitle = computed(() => {
  if (!account.value) return 'Chargement...'
  if (account.value.partner) return `${account.value.name} & ${account.value.partner.name} — projets, rêves et moments partagés`
  return `${account.value.name} — en attente de ton/ta partenaire`
})

// Partner ID helpers
const myId = computed(() => account.value?.id)
const partnerId = computed(() => account.value?.partner?.id || null)

// Mini map
const miniMapRef = ref<HTMLElement | null>(null)
const visitedCountries = ref<string[]>([])
let miniMap: any = null

async function initMiniMap() {
  if (!miniMapRef.value) return
  try { visitedCountries.value = await $fetch('/api/visited') } catch { visitedCountries.value = [] }

  const L = (await import('leaflet')).default
  miniMap = L.map(miniMapRef.value, { center: [25, 0], zoom: 1.5, zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: true })
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(miniMap)

  try {
    const resp = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    const geoJson = await resp.json()
    const visitedCount = visitedCountries.value.map((v: any) => v.country_name)
    // Get English names of visited countries
    const countries = await $fetch('/api/countries')
    const visitedEn = countries.filter((c: any) => visitedCount.includes(c.name)).map((c: any) => c.en)
    
    L.geoJSON(geoJson, {
      style: (feature: any) => {
        const name = feature?.properties?.name
        if (!visitedEn.includes(name)) return { fillOpacity: 0, color: 'transparent', weight: 0 }
        // Determine color by who visited
        const vc = visitedCountries.value.find((v: any) => v.country_name === countries.find((c: any) => c.en === name)?.name)
        const by = vc?.visited_by || 'both'
        const color = by === 'aksel' ? '#4da6ff' : by === 'amandine' ? '#ff6b8a' : '#F5A623'
        return { fillColor: color, fillOpacity: 0.4, color, weight: 1, opacity: 0.8 }
      },
      onEachFeature: (_feature: any, layer: any) => {
        layer.on('click', () => navigateTo('/carte'))
      },
    }).addTo(miniMap)
  } catch {}

  setTimeout(() => miniMap?.invalidateSize(), 300)
}

const todos = ref<any[]>([])
const events = ref<any[]>([])
const users = ref<any[]>([])
const loading = ref(true)

const mainRef = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const quickRef = ref<HTMLElement | null>(null)
const panelsRef = ref<HTMLElement | null>(null)

// Quick action modals
const showQuickTodo = ref(false)
const showQuickEvent = ref(false)
const quickEventType = ref<'date_night' | 'event' | 'availability'>('date_night')
const quickTodoRef = ref<HTMLFormElement | null>(null)
const quickEventRef = ref<HTMLFormElement | null>(null)

const today = new Date().toISOString().split('T')[0]

let ctx: gsap.Context | null = null

onMounted(async () => {
  try { await setupDb() } catch (e) { /* ok */ }
  const [t, e, u] = await Promise.all([fetchTodos({ status: 'todo' }), fetchEvents(), fetchUsers()])
  todos.value = t || []; events.value = e || []; users.value = u || []
  loading.value = false
  await nextTick()

  initMiniMap()

  loadDashboardMoods()

  ctx = gsap.context(() => {
    gsap.registerPlugin(ScrollTrigger)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(heroRef.value, { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6 })
      .fromTo('.stat-card', { autoAlpha: 0, y: 30, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.4)' }, '-=0.3')
      .fromTo('.quick-btn', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power3.out' }, '-=0.2')

    gsap.fromTo('.panel', { autoAlpha: 0, y: 40, scrollTrigger: { trigger: panelsRef.value, start: 'top 85%', toggleActions: 'play none none none' } },
      { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out' })
  })
})

onUnmounted(() => { ctx?.revert(); ScrollTrigger.getAll().forEach(t => t.kill()); if (miniMap) miniMap.remove() })

const pendingTodos = computed(() => todos.value.filter((t: any) => t.status !== 'done'))
const dreamCount = computed(() => todos.value.filter((t: any) => t.priority === 'dream').length)
const doneCount = computed(() => todos.value.filter((t: any) => t.status === 'done').length)
const todayEvents = computed(() => {
  const td = new Date().toISOString().split('T')[0]
  return events.value.filter((e: any) => e.start_time?.startsWith(td))
})

function getUrgencyStyle(todo: any) {
  if (todo.priority === 'dream') return { border: 'border-lavender/20', bg: 'bg-lavender/5' }
  if (todo.priority === 'high') return { border: 'border-rose/20', bg: 'bg-rose/5' }
  return { border: 'border-mint/20', bg: 'bg-mint/5' }
}
function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

const quickActions = [
  { icon: 'lucide:heart', label: 'Proposer une date', color: 'from-rose to-rose-soft', desc: 'Date night', action: () => { quickEventType.value = 'date_night'; showQuickEvent.value = true } },
  { icon: 'lucide:map-pin', label: 'Proposer une sortie', color: 'from-lavender to-rose', desc: 'Resto, ciné, balade...', action: () => { quickEventType.value = 'event'; showQuickEvent.value = true } },
  { icon: 'lucide:plane', label: 'Proposer un voyage', color: 'from-gold to-rose', desc: 'Week-end, vacances...', action: () => { quickEventType.value = 'trip'; showQuickEvent.value = true } },
  { icon: 'lucide:plus-circle', label: 'Suggérer une activité', color: 'from-mint to-lavender', desc: 'Ajouter à faire', action: () => { showQuickTodo.value = true } },
]

async function onSubmitQuickTodo() {
  if (!quickTodoRef.value) return
  const fd = new FormData(quickTodoRef.value)
  await createTodo({
    title: fd.get('title'),
    description: fd.get('description'),
    category_id: parseInt(fd.get('category_id') as string) || 1,
    priority: fd.get('priority') || 'medium',
    assigned_to: fd.get('assigned_to') === 'partner' ? partnerId.value : myId.value,
    status: 'todo'
  })
  showQuickTodo.value = false
  const t = await fetchTodos({ status: 'todo' })
  todos.value = t || []
}

async function onSubmitQuickEvent() {
  if (!quickEventRef.value) return
  const fd = new FormData(quickEventRef.value)
  const date = fd.get('start_date') as string || today
  const endDate = fd.get('end_date') as string
  const hasEnd = endDate && endDate !== date
  const colors: Record<string, string> = { date_night: '#ff6b8a', trip: '#f0c060', event: '#a78bfa', availability: '#4adec0', reminder: '#f0c060' }
  await createEvent({
    title: fd.get('title'),
    description: fd.get('description') || '',
    event_type: quickEventType.value,
    start_time: date + 'T00:00:00.000Z',
    end_time: hasEnd ? endDate + 'T23:59:59.000Z' : null,
    all_day: true,
    color: colors[quickEventType.value] || '#a78bfa',
    created_by: myId.value,
  })
  showQuickEvent.value = false
  const e = await fetchEvents()
  events.value = e || []
}

const stats = [
  { icon: 'lucide:list-todo', label: 'En attente', value: computed(() => pendingTodos.value.length), color: 'text-rose', bg: 'bg-rose/10' },
  { icon: 'lucide:sparkles', label: 'Rêves', value: dreamCount, color: 'text-lavender', bg: 'bg-lavender/10' },
  { icon: 'lucide:calendar-days', label: 'Aujourd\'hui', value: computed(() => todayEvents.value.length), color: 'text-mint', bg: 'bg-mint/10' },
  { icon: 'lucide:check-circle', label: 'Complétés', value: doneCount, color: 'text-gold', bg: 'bg-gold/10' },
]

// Countdown — find the next upcoming event
const nextBigEvent = computed(() => {
  const now = new Date()
  const future = events.value
    .filter((e: any) => new Date(e.start_time) > now)
    .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  return future[0] || null
})

const countdown = computed(() => {
  if (!nextBigEvent.value) return { days: 0, hours: 0 }
  const diff = new Date(nextBigEvent.value.start_time).getTime() - Date.now()
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  }
})

// Roulette
const randomIdea = ref<any>(null)
const allIdeas = computed(() => todos.value.filter((t: any) => t.category_name === 'À faire' && t.status === 'todo'))

// Mood
const todayMoods = ref<any[]>([])

async function loadDashboardMoods() {
  try { todayMoods.value = await $fetch('/api/moods') } catch { todayMoods.value = [] }
}

async function quickSetMood(mood: string) {
  await $fetch('/api/moods', { method: 'POST', body: { mood } })
  await loadDashboardMoods()
}

function spinRoulette() {
  const ideas = allIdeas.value
  if (ideas.length === 0) return
  const pick = ideas[Math.floor(Math.random() * ideas.length)]
  randomIdea.value = pick
  nextTick(() => {
    gsap.fromTo('.animate-slide-up', { autoAlpha: 0, y: 12, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.3)' })
  })
}
</script>

<template>
  <div ref="mainRef" class="max-w-6xl mx-auto px-4 py-8">
    <!-- Hero -->
    <div ref="heroRef" class="text-center mb-8">
      <h1 class="text-3xl sm:text-4xl font-bold mb-2">
        <span class="bg-gradient-to-r from-rose via-gold to-lavender bg-clip-text text-transparent">Nous Deux</span>
      </h1>
      <p class="text-text-muted text-sm sm:text-base">{{ subtitle }}</p>
    </div>

    <!-- Quick Actions — Amandine -->
    <div ref="quickRef" class="mb-8">
      <p class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <span class="w-1 h-3 rounded-full bg-rose/60" /> Actions rapides
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button v-for="qa in quickActions" :key="qa.label" @click="qa.action"
          class="quick-btn bg-surface border border-border rounded-2xl p-4 text-left hover:border-rose/30 hover:bg-surface2 transition-all duration-200 group">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300" :class="qa.color">
            <Icon :icon="qa.icon" class="w-5 h-5 text-white" />
          </div>
          <p class="text-sm font-semibold text-text">{{ qa.label }}</p>
          <p class="text-xs text-text-muted mt-0.5">{{ qa.desc }}</p>
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div v-for="s in stats" :key="s.label" class="stat-card bg-surface border border-border rounded-2xl p-5 hover:border-rose/20 transition-colors duration-300">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" :class="s.bg">
          <Icon :icon="s.icon" class="w-5 h-5" :class="s.color" />
        </div>
        <div class="text-2xl font-bold text-text">{{ s.value.value }}</div>
        <div class="text-sm text-text-muted">{{ s.label }}</div>
      </div>
    </div>

    <!-- Mini Carte du Monde -->
    <div class="mb-6 bg-surface border border-border rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 pt-5 pb-0">
        <p class="text-sm font-bold flex items-center gap-2"><Icon icon="lucide:globe" class="w-4 h-4 text-gold" /> Carte du monde</p>
        <NuxtLink to="/carte" class="text-xs text-gold hover:text-gold-soft transition-colors flex items-center gap-1">
          Explorer <Icon icon="lucide:arrow-right" class="w-3 h-3" />
        </NuxtLink>
      </div>
      <div ref="miniMapRef" class="w-full h-[200px] sm:h-[250px]" />
    </div>
    <div v-if="nextBigEvent" class="mb-6 bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 overflow-hidden relative">
      <div class="absolute inset-0 bg-gradient-to-r from-rose/5 via-transparent to-lavender/5" />
      <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 z-10" :style="{ background: (nextBigEvent.color || '#a78bfa') + '20' }">
        <Icon icon="lucide:clock" class="w-6 h-6" :style="{ color: nextBigEvent.color || '#a78bfa' }" />
      </div>
      <div class="flex-1 min-w-0 z-10">
        <p class="text-sm font-semibold text-text truncate">{{ nextBigEvent.title }}</p>
        <p class="text-xs text-text-muted">
          <span v-if="countdown.days > 0" class="text-rose font-bold">{{ countdown.days }} jours</span>
          <span v-else-if="countdown.hours > 0" class="text-gold font-bold">{{ countdown.hours }} heures</span>
          <span v-else class="text-mint font-bold">Aujourd'hui !</span>
          — {{ formatDate(nextBigEvent.start_time) }}
        </p>
      </div>
    </div>

    <!-- Mood du jour -->
    <div class="mb-6 bg-surface border border-border rounded-2xl p-5">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm font-bold flex items-center gap-2"><Icon icon="lucide:smile" class="w-4 h-4 text-gold" /> Mood du jour</p>
        <NuxtLink to="/moments" class="text-xs text-gold hover:text-gold-soft transition-colors">Voir plus →</NuxtLink>
      </div>
      <div v-if="todayMoods.length === 0" class="text-center py-4">
        <p class="text-text-muted text-sm">Pas encore de mood aujourd'hui</p>
        <button @click="quickSetMood('😊')" class="mt-2 px-4 py-1.5 rounded-lg bg-surface2 border border-border text-sm hover:border-gold/30 transition-colors">Enregistrer mon mood</button>
      </div>
      <div v-else class="flex items-center justify-center gap-8">
        <div v-for="m in todayMoods" :key="m.account_id" class="text-center">
          <div class="text-3xl mb-1">{{ m.mood }}</div>
          <p class="text-xs font-medium" :style="{ color: m.color }">{{ m.name }}</p>
        </div>
      </div>
    </div>

    <!-- Roulette à dates -->
    <div class="mb-6">
      <p class="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <span class="w-1 h-3 rounded-full bg-gold/60" /> 🎲 Roulette à dates
      </p>
      <div class="bg-surface border border-border rounded-2xl p-6 text-center">
        <p class="text-text-muted text-sm mb-4">En panne d'inspiration ? Laisse le hasard décider !</p>
        <div v-if="randomIdea" class="mb-4 p-4 bg-surface2 rounded-xl animate-slide-up" :key="randomIdea.title">
          <Icon icon="lucide:sparkles" class="w-6 h-6 text-gold mx-auto mb-2" />
          <p class="text-lg font-bold text-text">{{ randomIdea.title }}</p>
          <p v-if="randomIdea.description" class="text-sm text-text-muted mt-1">{{ randomIdea.description }}</p>
        </div>
        <button @click="spinRoulette"
          class="px-6 py-3 bg-gradient-to-r from-gold to-rose rounded-xl text-white font-bold text-sm hover:scale-105 transition-transform duration-300 shadow-lg shadow-gold/20 flex items-center gap-2 mx-auto">
          <Icon icon="lucide:dices" class="w-4 h-4" /> {{ randomIdea ? 'Relancer' : 'Lancer la roulette' }}
        </button>
      </div>
    </div>

    <!-- Panels -->
    <div ref="panelsRef" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="panel bg-surface border border-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold flex items-center gap-2"><Icon icon="lucide:list-todo" class="w-5 h-5 text-rose" /> Tâches récentes</h2>
          <NuxtLink to="/todos" class="text-sm text-rose hover:text-rose-soft transition-colors">Voir tout →</NuxtLink>
        </div>
        <div v-if="loading" class="text-center py-8 text-text-muted"><Icon icon="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin mb-3" /><p>Chargement...</p></div>
        <div v-else-if="todos.length === 0" class="text-center py-8 text-text-muted"><Icon icon="lucide:party-popper" class="w-10 h-10 mx-auto mb-2 text-gold" /><p>Aucune tâche pour le moment</p></div>
        <div v-else class="space-y-1">
          <div v-for="todo in todos.slice(0, 5)" :key="todo.id"
            class="flex items-center gap-3 p-3 rounded-xl border-l-2 transition-all duration-200 hover:bg-surface2 cursor-pointer"
            :class="[getUrgencyStyle(todo).border, getUrgencyStyle(todo).bg]">
            <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: todo.category_color || '#f0c060' }" />
            <div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">{{ todo.title }}</p></div>
            <div v-if="todo.assignee_name" class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border text-text-muted">
              <Icon icon="lucide:user" class="w-3 h-3" /> {{ todo.assignee_name }}
            </div>
          </div>
        </div>
      </div>
      <div class="panel bg-surface border border-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold flex items-center gap-2"><Icon icon="lucide:calendar-days" class="w-5 h-5 text-lavender" /> À venir</h2>
          <NuxtLink to="/calendrier" class="text-sm text-lavender hover:text-lavender-soft transition-colors">Calendrier →</NuxtLink>
        </div>
        <div v-if="loading" class="text-center py-8 text-text-muted"><Icon icon="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin mb-3" /><p>Chargement...</p></div>
        <div v-else-if="events.length === 0" class="text-center py-8 text-text-muted"><Icon icon="lucide:calendar-off" class="w-10 h-10 mx-auto mb-2" /><p>Aucun événement</p></div>
        <div v-else class="space-y-1">
          <div v-for="event in events.slice(0, 5)" :key="event.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface2 transition-all">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: (event.color || '#a78bfa') + '15' }">
              <Icon :icon="event.event_type === 'date_night' ? 'lucide:heart' : event.event_type === 'availability' ? 'lucide:circle-check' : event.event_type === 'reminder' ? 'lucide:bell' : 'lucide:calendar'" class="w-4 h-4" :style="{ color: event.color || '#a78bfa' }" />
            </div>
            <div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">{{ event.title }}</p><p class="text-xs text-text-muted">{{ formatDate(event.start_time) }}</p></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Todo Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showQuickTodo" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showQuickTodo = false" />
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 class="text-lg font-bold mb-4">Suggérer une activité</h3>
            <form ref="quickTodoRef" @submit.prevent="onSubmitQuickTodo" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Titre *</label>
                <input name="title" required class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" placeholder="ex: Aller au musée..." />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Détail (optionnel)</label>
                <textarea name="description" rows="2" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors resize-none" placeholder="Quelques précisions..." />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Catégorie</label>
                  <select name="category_id" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                    <option value="1">À faire</option><option value="4">Rêves</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Priorité</label>
                  <select name="priority" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                    <option value="dream">Rêve</option><option value="high">Haute</option><option value="medium" selected>Moyenne</option><option value="low">Basse</option>
                  </select>
                </div>
              </div>
              <input type="hidden" name="assigned_to" value="amandine" />
              <div class="flex gap-3 pt-2">
                <button type="button" @click="showQuickTodo = false" class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
                <button type="submit" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                  <Icon icon="lucide:send" class="w-4 h-4" /> Proposer
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Quick Event Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showQuickEvent" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showQuickEvent = false" />
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon :icon="quickEventType === 'date_night' ? 'lucide:heart' : quickEventType === 'trip' ? 'lucide:plane' : quickEventType === 'availability' ? 'lucide:circle-check' : 'lucide:map-pin'" class="w-5 h-5 text-rose" />
              {{ quickEventType === 'date_night' ? 'Proposer une date' : quickEventType === 'trip' ? 'Proposer un voyage' : quickEventType === 'availability' ? 'Indiquer mes dispos' : 'Proposer une sortie' }}
            </h3>
            <form ref="quickEventRef" @submit.prevent="onSubmitQuickEvent" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Titre *</label>
                <input name="title" required :placeholder="quickEventType === 'date_night' ? 'ex: Soirée romantique...' : quickEventType === 'trip' ? 'ex: Week-end à Amsterdam' : quickEventType === 'availability' ? 'ex: Dispo toute la journée' : 'ex: Resto italien, ciné...'" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors" />
              </div>
              <div v-if="quickEventType !== 'availability'">
                <label class="block text-sm font-medium text-text-muted mb-1">Description</label>
                <textarea name="description" rows="2" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors resize-none" placeholder="Détails, lieu..." />
              </div>
              <div class="grid gap-3" :class="quickEventType === 'trip' ? 'grid-cols-2' : 'grid-cols-1'">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">{{ quickEventType === 'trip' ? 'Du' : 'Date' }}</label>
                  <input type="date" name="start_date" :value="today" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
                </div>
                <div v-if="quickEventType === 'trip'">
                  <label class="block text-sm font-medium text-text-muted mb-1">Au</label>
                  <input type="date" name="end_date" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
                </div>
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" @click="showQuickEvent = false" class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
                <button type="submit" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                  <Icon icon="lucide:send" class="w-4 h-4" /> Proposer
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
</style>
