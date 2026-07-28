<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

definePageMeta({ layout: 'default' })

const { fetchTodos, fetchEvents, fetchUsers, setupDb } = useApi()

const todos = ref<any[]>([])
const events = ref<any[]>([])
const users = ref<any[]>([])
const loading = ref(true)

const mainRef = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const statsRef = ref<HTMLElement | null>(null)
const panelsRef = ref<HTMLElement | null>(null)

let ctx: gsap.Context | null = null

onMounted(async () => {
  try { await setupDb() } catch (e) { /* already set up */ }

  const [t, e, u] = await Promise.all([
    fetchTodos({ status: 'todo' }),
    fetchEvents(),
    fetchUsers()
  ])
  todos.value = t || []
  events.value = e || []
  users.value = u || []
  loading.value = false

  await nextTick()

  ctx = gsap.context(() => {
    gsap.registerPlugin(ScrollTrigger)

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(heroRef.value, { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6 })
      .fromTo('.stat-card', { autoAlpha: 0, y: 30, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.4)' }, '-=0.3')

    gsap.fromTo('.panel', {
      autoAlpha: 0, y: 40,
      scrollTrigger: { trigger: panelsRef.value, start: 'top 85%', toggleActions: 'play none none none' }
    }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out' })

    gsap.fromTo('.todo-row', {
      autoAlpha: 0, x: -15,
      scrollTrigger: { trigger: panelsRef.value, start: 'top 85%', toggleActions: 'play none none none' }
    }, { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out', delay: 0.4 })
  })
})

onUnmounted(() => { ctx?.revert(); ScrollTrigger.getAll().forEach(t => t.kill()) })

const pendingTodos = computed(() => todos.value.filter((t: any) => t.status !== 'done'))
const dreamCount = computed(() => todos.value.filter((t: any) => t.priority === 'dream').length)
const doneCount = computed(() => todos.value.filter((t: any) => t.status === 'done').length)
const todayEvents = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return events.value.filter((e: any) => e.start_time?.startsWith(today))
})

function getUrgencyStyle(todo: any) {
  if (todo.priority === 'dream') return { border: 'border-lavender/20', bg: 'bg-lavender/5' }
  if (todo.priority === 'high') return { border: 'border-rose/20', bg: 'bg-rose/5' }
  if (todo.priority === 'medium') return { border: 'border-gold/20', bg: 'bg-gold/5' }
  return { border: 'border-mint/20', bg: 'bg-mint/5' }
}

function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

const stats = [
  { icon: 'lucide:list-todo', label: 'En attente', value: computed(() => pendingTodos.value.length), color: 'text-rose', bg: 'bg-rose/10' },
  { icon: 'lucide:sparkles', label: 'Rêves', value: dreamCount, color: 'text-lavender', bg: 'bg-lavender/10' },
  { icon: 'lucide:calendar-days', label: 'Aujourd\'hui', value: computed(() => todayEvents.value.length), color: 'text-mint', bg: 'bg-mint/10' },
  { icon: 'lucide:check-circle', label: 'Complétés', value: doneCount, color: 'text-gold', bg: 'bg-gold/10' },
]
</script>

<template>
  <div ref="mainRef" class="max-w-6xl mx-auto px-4 py-8">
    <!-- Hero -->
    <div ref="heroRef" class="text-center mb-10">
      <h1 class="text-4xl font-bold mb-2">
        <span class="bg-gradient-to-r from-rose via-gold to-lavender bg-clip-text text-transparent">Nous Deux</span>
      </h1>
      <p class="text-text-muted">Aksel & Amandine — projets, rêves et moments partagés</p>
    </div>

    <!-- Stats -->
    <div ref="statsRef" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <div v-for="s in stats" :key="s.label" class="stat-card bg-surface border border-border rounded-2xl p-5 hover:border-rose/20 transition-colors duration-300 group cursor-default">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" :class="s.bg">
          <Icon :icon="s.icon" class="w-5 h-5" :class="s.color" />
        </div>
        <div class="text-2xl font-bold text-text">{{ s.value.value }}</div>
        <div class="text-sm text-text-muted">{{ s.label }}</div>
      </div>
    </div>

    <!-- Panels -->
    <div ref="panelsRef" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Tasks panel -->
      <div class="panel bg-surface border border-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold flex items-center gap-2"><Icon icon="lucide:list-todo" class="w-5 h-5 text-rose" /> Tâches récentes</h2>
          <NuxtLink to="/todos" class="text-sm text-rose hover:text-rose-soft transition-colors">Voir tout →</NuxtLink>
        </div>
        <div v-if="loading" class="text-center py-8 text-text-muted">
          <Icon icon="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin mb-3" />
          <p>Chargement...</p>
        </div>
        <div v-else-if="todos.length === 0" class="text-center py-8 text-text-muted">
          <Icon icon="lucide:party-popper" class="w-10 h-10 mx-auto mb-2 text-gold" />
          <p>Aucune tâche pour le moment</p>
        </div>
        <div v-else class="space-y-1">
          <div v-for="todo in todos.slice(0, 5)" :key="todo.id"
            class="todo-row flex items-center gap-3 p-3 rounded-xl border-l-2 transition-all duration-200 hover:bg-surface2 cursor-pointer group"
            :class="[getUrgencyStyle(todo).border, getUrgencyStyle(todo).bg]">
            <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: todo.category_color || '#f0c060' }" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ todo.title }}</p>
              <p class="text-xs text-text-muted">{{ todo.category_name || 'Sans catégorie' }}</p>
            </div>
            <div v-if="todo.assignee_name" class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border text-text-muted">
              <Icon icon="lucide:user" class="w-3 h-3" :style="{ color: todo.assignee_color }" />
              {{ todo.assignee_name }}
            </div>
          </div>
        </div>
      </div>

      <!-- Events panel -->
      <div class="panel bg-surface border border-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold flex items-center gap-2"><Icon icon="lucide:calendar-days" class="w-5 h-5 text-lavender" /> À venir</h2>
          <NuxtLink to="/calendrier" class="text-sm text-lavender hover:text-lavender-soft transition-colors">Calendrier →</NuxtLink>
        </div>
        <div v-if="loading" class="text-center py-8 text-text-muted">
          <Icon icon="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin mb-3" />
          <p>Chargement...</p>
        </div>
        <div v-else-if="events.length === 0" class="text-center py-8 text-text-muted">
          <Icon icon="lucide:calendar-off" class="w-10 h-10 mx-auto mb-2 text-text-muted" />
          <p>Aucun événement prévu</p>
        </div>
        <div v-else class="space-y-1">
          <div v-for="event in events.slice(0, 5)" :key="event.id"
            class="todo-row flex items-center gap-3 p-3 rounded-xl hover:bg-surface2 transition-all duration-200">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: (event.color || '#a78bfa') + '15' }">
              <Icon :icon="event.event_type === 'date_night' ? 'lucide:heart' : event.event_type === 'availability' ? 'lucide:circle-check' : event.event_type === 'reminder' ? 'lucide:bell' : 'lucide:calendar'" class="w-4 h-4" :style="{ color: event.color || '#a78bfa' }" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ event.title }}</p>
              <p class="text-xs text-text-muted">{{ formatDate(event.start_time) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
