<script setup lang="ts">
import { gsap } from 'gsap'

const api = useApi()

const items = ref<any[]>([])
const loading = ref(true)
const activeFilter = ref('upcoming')
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const pendingDelete = ref<number | null>(null)
const errorMsg = ref('')
const now = ref(Date.now())

const KINDS = [
  { key: 'meeting', label: 'Réunion', icon: 'lucide:users' },
  { key: 'call', label: 'Appel / Visio', icon: 'lucide:video' },
  { key: 'client', label: 'Client', icon: 'lucide:building-2' },
  { key: 'interview', label: 'Entretien', icon: 'lucide:user-search' },
  { key: 'deadline', label: 'Échéance', icon: 'lucide:alarm-clock' },
  { key: 'other', label: 'Autre', icon: 'lucide:tag' },
]

const STATUSES = [
  { key: 'planned', label: 'À confirmer', class: 'bg-gold/15 text-gold border-gold/25' },
  { key: 'confirmed', label: 'Confirmé', class: 'bg-mint/15 text-mint border-mint/25' },
  { key: 'done', label: 'Terminé', class: 'bg-lavender/15 text-lavender border-lavender/25' },
  { key: 'cancelled', label: 'Annulé', class: 'bg-rose/15 text-rose border-rose/25' },
]

const filters = [
  { key: 'upcoming', label: 'À venir', icon: 'lucide:calendar-clock' },
  { key: 'today', label: "Aujourd'hui", icon: 'lucide:sun' },
  { key: 'week', label: '7 jours', icon: 'lucide:calendar-range' },
  { key: 'past', label: 'Passés', icon: 'lucide:history' },
  { key: 'all', label: 'Tous', icon: 'lucide:layers' },
]

const kindOf = (k: string) => KINDS.find(x => x.key === k) || KINDS[0]
const statusOf = (s: string) => STATUSES.find(x => x.key === s) || STATUSES[0]

/* ---------- dates ---------- */
function startOfDay(d: Date | string = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}
function endOfDay(d: Date | string = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x
}
const pad = (n: number) => String(n).padStart(2, '0')
function toDateInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimeInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// An all-day entry stays "current" until the end of its day
function effectiveEnd(i: any) {
  if (i.ends_at) return new Date(i.ends_at)
  return i.all_day ? endOfDay(i.starts_at) : new Date(i.starts_at)
}
function timeLabel(i: any) {
  if (i.all_day) return 'Journée'
  return new Date(i.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function timeRange(i: any) {
  if (i.all_day) return 'Journée'
  const s = timeLabel(i)
  if (!i.ends_at) return s
  return `${s} – ${new Date(i.ends_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}
function dayLabel(d: Date) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay().getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/* ---------- data ---------- */
async function load() {
  try {
    items.value = (await api.fetchBusinessDates()) || []
    errorMsg.value = ''
  } catch (e: any) {
    items.value = []
    errorMsg.value = "Impossible de charger les rendez-vous."
  }
  loading.value = false
  await nextTick()
  animate()
}

let ctx: gsap.Context | null = null
function animate() {
  ctx?.revert()
  ctx = gsap.context(() => {
    gsap.fromTo('.stat-card', { autoAlpha: 0, y: 18, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.07, ease: 'back.out(1.3)' })
    gsap.fromTo('.biz-card', { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power3.out', delay: 0.05 })
  })
}

/* ---------- derived ---------- */
const filtered = computed(() => {
  const t0 = startOfDay(), t1 = endOfDay()
  const weekEnd = new Date(t0); weekEnd.setDate(weekEnd.getDate() + 7)
  const n = now.value
  let list = items.value
  if (activeFilter.value === 'today') list = list.filter(i => startOfDay(i.starts_at) <= t1 && endOfDay(i.starts_at) >= t0)
  else if (activeFilter.value === 'week') list = list.filter(i => effectiveEnd(i).getTime() >= t0.getTime() && new Date(i.starts_at).getTime() <= weekEnd.getTime())
  else if (activeFilter.value === 'upcoming') list = list.filter(i => i.status !== 'cancelled' && i.status !== 'done' && effectiveEnd(i).getTime() >= n)
  else if (activeFilter.value === 'past') list = list.filter(i => effectiveEnd(i).getTime() < n).slice().reverse()
  return list
})

const grouped = computed(() => {
  const groups: { key: string; label: string; items: any[] }[] = []
  for (const it of filtered.value) {
    const d = new Date(it.starts_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, label: dayLabel(d), items: [] }; groups.push(g) }
    g.items.push(it)
  }
  for (const g of groups) g.items.sort((a, b) => Number(b.all_day) - Number(a.all_day) || new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  return groups
})

const nextUp = computed(() => {
  const n = now.value
  return items.value
    .filter(i => i.status !== 'cancelled' && i.status !== 'done' && effectiveEnd(i).getTime() >= n)
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] || null
})

const nextIn = computed(() => {
  if (!nextUp.value) return ''
  const diff = new Date(nextUp.value.starts_at).getTime() - now.value
  if (diff <= 0) return 'en cours'
  const min = Math.round(diff / 60000)
  if (min < 60) return `dans ${min} min`
  const h = Math.floor(min / 60), m = min % 60
  if (h < 24) return m ? `dans ${h} h ${m}` : `dans ${h} h`
  const d = Math.round(h / 24)
  return d <= 1 ? 'demain' : `dans ${d} jours`
})

const stats = computed(() => {
  const t0 = startOfDay(), t1 = endOfDay()
  const weekEnd = new Date(t0); weekEnd.setDate(weekEnd.getDate() + 7)
  const n = now.value
  return [
    { icon: 'lucide:sun', label: "Aujourd'hui", value: items.value.filter(i => startOfDay(i.starts_at) <= t1 && endOfDay(i.starts_at) >= t0 && i.status !== 'cancelled').length, color: 'text-mint', bg: 'bg-mint/10' },
    { icon: 'lucide:calendar-range', label: '7 jours', value: items.value.filter(i => i.status !== 'cancelled' && effectiveEnd(i).getTime() >= n && new Date(i.starts_at).getTime() <= weekEnd.getTime()).length, color: 'text-rose', bg: 'bg-rose/10' },
    { icon: 'lucide:clock-alert', label: 'À confirmer', value: items.value.filter(i => i.status === 'planned' && effectiveEnd(i).getTime() >= n).length, color: 'text-gold', bg: 'bg-gold/10' },
    { icon: 'lucide:check-circle', label: 'Terminés', value: items.value.filter(i => i.status === 'done').length, color: 'text-lavender', bg: 'bg-lavender/10' },
  ]
})

/* ---------- form ---------- */
const blank = () => ({
  title: '', contact: '', kind: 'meeting', location: '', meeting_url: '',
  date: toDateInput(new Date().toISOString()), end_date: '', start_time: '09:00', end_time: '10:00',
  all_day: false, status: 'planned', reminder_min: 30, notes: '',
})
const form = reactive(blank())

// La fin suit le début tant que l'utilisateur ne l'a pas réglée elle-même
watch(() => form.start_time, (v) => {
  if (!v || form.all_day) return
  if (!form.end_time || form.end_time <= v) {
    const [h, m] = v.split(':').map(Number)
    const total = Math.min(h * 60 + m + 60, 23 * 60 + 59)
    form.end_time = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
  }
})

function openCreate() {
  Object.assign(form, blank())
  editing.value = null
  errorMsg.value = ''
  showModal.value = true
}

function openEdit(it: any) {
  Object.assign(form, blank(), {
    title: it.title || '',
    contact: it.contact || '',
    kind: it.kind || 'meeting',
    location: it.location || '',
    meeting_url: it.meeting_url || '',
    date: toDateInput(it.starts_at),
    end_date: '',
    start_time: it.all_day ? '09:00' : (toTimeInput(it.starts_at) || '09:00'),
    end_time: !it.all_day && it.ends_at ? toTimeInput(it.ends_at) : '',
    all_day: !!it.all_day,
    status: it.status || 'planned',
    reminder_min: it.reminder_min ?? 30,
    notes: it.notes || '',
  })
  editing.value = { ...it }
  errorMsg.value = ''
  showModal.value = true
}

defineExpose({ openCreate })

async function onSubmit() {
  if (!form.title.trim() || !form.date || saving.value) return
  let starts_at: string, ends_at: string | null = null
  if (form.all_day) {
    starts_at = new Date(`${form.date}T00:00`).toISOString()
    const endDate = form.end_date && form.end_date !== form.date ? form.end_date : ''
    ends_at = endDate ? new Date(`${endDate}T23:59`).toISOString() : null
  } else {
    starts_at = new Date(`${form.date}T${form.start_time || '09:00'}`).toISOString()
    ends_at = form.end_time ? new Date(`${form.date}T${form.end_time}`).toISOString() : null
    // Une fin avant le début n'a pas de sens : on la retire plutôt que d'enregistrer un créneau négatif
    if (ends_at && new Date(ends_at).getTime() <= new Date(starts_at).getTime()) ends_at = null
  }
  const payload = {
    title: form.title.trim(),
    contact: form.contact.trim(),
    kind: form.kind,
    location: form.location.trim(),
    meeting_url: form.meeting_url.trim(),
    starts_at, ends_at,
    all_day: form.all_day,
    status: form.status,
    reminder_min: Number(form.reminder_min) || 0,
    notes: form.notes,
  }
  saving.value = true
  try {
    if (editing.value) await api.updateBusinessDate(editing.value.id, payload)
    else await api.createBusinessDate(payload)
    showModal.value = false
    editing.value = null
    await load()
  } catch (e: any) {
    errorMsg.value = "Enregistrement impossible. Réessaie."
  } finally {
    saving.value = false
  }
}

async function setStatus(it: any, status: string) {
  try {
    await api.updateBusinessDate(it.id, { status })
    await load()
  } catch { errorMsg.value = "Mise à jour impossible." }
}

async function removeIt(id: number) {
  try {
    await api.deleteBusinessDate(id)
    pendingDelete.value = null
    await load()
  } catch { errorMsg.value = "Suppression impossible." }
}

let timer: any = null
onMounted(async () => {
  await load()
  timer = setInterval(() => { now.value = Date.now() }, 60000)
})
onUnmounted(() => { ctx?.revert(); if (timer) clearInterval(timer) })
</script>
<template>
  <div>
    <p v-if="errorMsg" class="mb-4 text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{{ errorMsg }}</p>

    <!-- Next appointment -->
    <div v-if="nextUp" class="mb-6 rounded-2xl border border-border bg-gradient-to-br from-surface to-surface2 p-4 sm:p-5">
      <div class="flex items-center justify-between gap-3 mb-3">
        <p class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Prochain rendez-vous</p>
        <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose/10 text-rose border border-rose/20 flex-shrink-0">{{ nextIn }}</span>
      </div>
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-rose/10 flex items-center justify-center flex-shrink-0">
          <Icon :icon="kindOf(nextUp.kind).icon" class="w-5 h-5 text-rose" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-base font-bold leading-tight">{{ nextUp.title }}</p>
          <p class="text-xs text-text-muted mt-0.5">
            {{ dayLabel(new Date(nextUp.starts_at)) }} · {{ timeRange(nextUp) }}
            <span v-if="nextUp.contact"> · {{ nextUp.contact }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div v-for="s in stats" :key="s.label" class="stat-card bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" :class="s.bg">
          <Icon :icon="s.icon" class="w-4 h-4" :class="s.color" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none">{{ s.value }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">{{ s.label }}</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
      <button v-for="f in filters" :key="f.key" @click="activeFilter = f.key"
        class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2"
        :class="activeFilter === f.key
          ? 'bg-rose/15 text-rose border border-rose/30'
          : 'bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted/30'">
        <Icon :icon="f.icon" class="w-4 h-4" /> {{ f.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16 text-text-muted">
      <Icon icon="lucide:loader-circle" class="w-10 h-10 mx-auto animate-spin mb-4" />
      <p>Chargement des rendez-vous...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-rose/10 flex items-center justify-center mx-auto mb-4">
        <Icon icon="lucide:briefcase" class="w-8 h-8 text-rose" />
      </div>
      <h3 class="text-xl font-bold mb-2">Aucun rendez-vous</h3>
      <p class="text-text-muted mb-6">
        {{ activeFilter === 'all' ? 'Ajoute ton premier rendez-vous pro.' : 'Rien sur ce filtre — essaie « Tous ».' }}
      </p>
      <button @click="openCreate"
        class="px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm flex items-center gap-2 mx-auto">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouveau rendez-vous
      </button>
    </div>

    <!-- Groups -->
    <div v-else class="space-y-6">
      <div v-for="g in grouped" :key="g.key">
        <div class="flex items-center gap-2 px-1 mb-3">
          <div class="w-1 h-4 rounded-full bg-rose/50" />
          <span class="text-sm font-semibold capitalize">{{ g.label }}</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-surface2 text-text-muted">{{ g.items.length }}</span>
        </div>

        <div class="space-y-2">
          <div v-for="it in g.items" :key="it.id"
            class="biz-card bg-surface border border-border rounded-xl p-4 hover:border-rose/20 transition-all duration-200 group"
            :class="{ 'opacity-60': it.status === 'cancelled' }">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center flex-shrink-0">
                <Icon :icon="kindOf(it.kind).icon" class="w-4 h-4 text-text-muted" />
              </div>

              <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(it)">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-medium" :class="{ 'line-through text-text-muted': it.status === 'done' || it.status === 'cancelled' }">{{ it.title }}</p>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-md border" :class="statusOf(it.status).class">{{ statusOf(it.status).label }}</span>
                </div>
                <p class="text-xs text-text-muted mt-1 flex items-center gap-2 flex-wrap">
                  <span class="flex items-center gap-1"><Icon icon="lucide:clock" class="w-3 h-3" /> {{ timeRange(it) }}</span>
                  <span v-if="it.contact" class="flex items-center gap-1"><Icon icon="lucide:building-2" class="w-3 h-3" /> {{ it.contact }}</span>
                  <span v-if="it.location" class="flex items-center gap-1"><Icon icon="lucide:map-pin" class="w-3 h-3" /> {{ it.location }}</span>
                  <span v-if="it.owner_name" class="flex items-center gap-1" :style="{ color: it.owner_color || undefined }">
                    <Icon icon="lucide:user" class="w-3 h-3" /> {{ it.owner_name }}
                  </span>
                </p>
                <p v-if="it.notes" class="text-xs text-text-muted/80 mt-1 line-clamp-1">{{ it.notes }}</p>
              </div>

              <div class="flex items-center gap-0.5 flex-shrink-0">
                <a v-if="it.meeting_url" :href="it.meeting_url" target="_blank" rel="noopener"
                  class="p-1.5 text-text-muted hover:text-mint transition-colors" aria-label="Ouvrir le lien" @click.stop>
                  <Icon icon="lucide:video" class="w-3.5 h-3.5" />
                </a>
                <button v-if="it.status === 'planned'" @click.stop="setStatus(it, 'confirmed')"
                  class="p-1.5 text-text-muted hover:text-mint transition-colors" aria-label="Confirmer">
                  <Icon icon="lucide:check" class="w-3.5 h-3.5" />
                </button>
                <button v-if="it.status !== 'done'" @click.stop="setStatus(it, 'done')"
                  class="p-1.5 text-text-muted hover:text-lavender transition-colors" aria-label="Marquer terminé">
                  <Icon icon="lucide:circle-check" class="w-3.5 h-3.5" />
                </button>
                <button @click.stop="pendingDelete = it.id"
                  class="p-1.5 text-text-muted hover:text-rose transition-colors" aria-label="Supprimer">
                  <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Delete confirm -->
            <div v-if="pendingDelete === it.id" class="mt-3 flex items-center gap-2 bg-rose/5 border border-rose/20 rounded-xl px-3 py-2">
              <p class="text-xs flex-1">Supprimer « {{ it.title }} » ?</p>
              <button @click.stop="pendingDelete = null" class="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:bg-surface2 transition-colors">Annuler</button>
              <button @click.stop="removeIt(it.id)" class="px-3 py-1 rounded-lg bg-rose text-white text-xs font-semibold hover:bg-rose-soft transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
          <div class="relative w-full sm:max-w-lg bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe-lg">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon icon="lucide:briefcase" class="w-5 h-5 text-rose" />
              {{ editing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous' }}
            </h3>

            <form @submit.prevent="onSubmit" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Titre *</label>
                <input v-model="form.title" required placeholder="Point hebdo Everbloo"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Type</label>
                  <select v-model="form.kind" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                    <option v-for="k in KINDS" :key="k.key" :value="k.key">{{ k.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Statut</label>
                  <select v-model="form.status" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                    <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Client / interlocuteur</label>
                <input v-model="form.contact" placeholder="Everbloo, M. Samama..."
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
              </div>

              <div class="flex items-center gap-3 bg-surface2 rounded-xl px-4 py-3">
                <input id="all_day" v-model="form.all_day" type="checkbox" class="w-4 h-4 accent-rose" />
                <label for="all_day" class="text-sm">Journée entière (sans horaire)</label>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div :class="form.all_day ? 'col-span-2' : ''">
                  <label class="block text-sm font-medium text-text-muted mb-1">Date *</label>
                  <input v-model="form.date" type="date" required
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                </div>
                <template v-if="!form.all_day">
                  <div>
                    <label class="block text-sm font-medium text-text-muted mb-1">Début</label>
                    <input v-model="form.start_time" type="time"
                      class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                  </div>
                  <div class="-mt-0">
                    <label class="block text-sm font-medium text-text-muted mb-1">Fin</label>
                    <input v-model="form.end_time" type="time"
                      class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                  </div>
                </template>
                <div v-else>
                  <label class="block text-sm font-medium text-text-muted mb-1">Jusqu'au (optionnel)</label>
                  <input v-model="form.end_date" type="date"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Lieu</label>
                  <input v-model="form.location" placeholder="Bureaux, visio..."
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Lien visio</label>
                  <input v-model="form.meeting_url" type="url" placeholder="https://meet.google.com/..."
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Notes</label>
                <textarea v-model="form.notes" rows="2" placeholder="Ordre du jour, points à aborder..."
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors resize-none" />
              </div>

              <div class="flex gap-3 pt-2">
                <button type="button" @click="showModal = false"
                  class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
                <button type="submit" :disabled="saving"
                  class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
                  <Icon :icon="saving ? 'lucide:loader-circle' : (editing ? 'lucide:save' : 'lucide:plus')"
                    class="w-4 h-4" :class="{ 'animate-spin': saving }" />
                  {{ editing ? 'Enregistrer' : 'Créer' }}
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
