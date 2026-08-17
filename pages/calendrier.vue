<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

const { fetchEvents, createEvent, updateEvent, deleteEvent, fetchUsers } = useApi()

const events = ref<any[]>([])
const users = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingEvent = ref<any>(null)
const selectedDate = ref('')
const selectedEndDate = ref('')
const eventFormRef = ref<HTMLFormElement | null>(null)

const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const today = new Date()

// Day sheet (mobile-first : taper un jour → détails du jour)
const showDaySheet = ref(false)
const selectedDay = ref<Date | null>(null)
const confirmingDelete = ref<number | null>(null)

const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const eventTypes: Record<string, { icon: string; label: string; color: string }> = {
  date_night: { icon: 'lucide:heart', label: 'Date night', color: '#ff6b8a' },
  event: { icon: 'lucide:calendar', label: 'Événement', color: '#a78bfa' },
  trip: { icon: 'lucide:plane', label: 'Voyage', color: '#f0c060' },
  availability: { icon: 'lucide:circle-check', label: 'Disponibilité', color: '#4adec0' },
  reminder: { icon: 'lucide:bell', label: 'Rappel', color: '#f0c060' },
}

const colorOptions = ['#ff6b8a', '#a78bfa', '#f0c060', '#4adec0', '#60a5fa']

const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(currentYear.value, currentMonth.value, -i)
    days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today) })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(currentYear.value, currentMonth.value, i)
    days.push({ date: d, isCurrentMonth: true, isToday: isSameDay(d, today) })
  }
  while (days.length < 42) {
    const last = days[days.length - 1].date
    const d = new Date(last); d.setDate(d.getDate() + 1)
    days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today) })
  }
  return days
})

function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function toDateStr(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

function getEventsForDay(date: Date) {
  const ds = toDateStr(date)
  return events.value.filter((e: any) => {
    const start = e.start_time?.split('T')[0]
    const end = e.end_time?.split('T')[0]
    if (end && end !== start) return ds >= start && ds <= end
    return start === ds
  })
}

function dayEventsCount(date: Date) { return getEventsForDay(date).length }

function prevMonth() { if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- } else currentMonth.value-- }
function nextMonth() { if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ } else currentMonth.value++ }

const calGridRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

async function loadData() {
  loading.value = true
  // Range en dates locales (pas d'ISO UTC qui décale d'un jour)
  const startDate = new Date(currentYear.value, currentMonth.value - 1, 1)
  const endDate = new Date(currentYear.value, currentMonth.value + 2, 0)
  const [e, u] = await Promise.allSettled([fetchEvents(toDateStr(startDate), toDateStr(endDate)), fetchUsers()])
  events.value = e.status === 'fulfilled' ? (e.value || []) : []
  users.value = u.status === 'fulfilled' ? (u.value || []) : []
  loading.value = false
  await nextTick()
  animateIn()
}

function animateIn() {
  ctx?.revert()
  // Pas d'animation sur mobile / reduced-motion : la grille reste visible
  try {
    if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    ctx = gsap.context(() => {
      gsap.from('.cal-day', { autoAlpha: 0, scale: 0.94, duration: 0.25, stagger: 0.005, ease: 'power2.out' })
      if (document.querySelector('.event-row')) {
        gsap.from('.event-row', { autoAlpha: 0, x: -12, duration: 0.3, stagger: 0.05, ease: 'power3.out', delay: 0.15 })
      }
    })
  } catch { /* GSAP absent → contenu reste visible */ }
}

// Taper un jour → sheet du jour (pas de sélection de plage à 2 clics)
function handleDayClick(date: Date) {
  selectedDay.value = date
  confirmingDelete.value = null
  showDaySheet.value = true
}

const selectedDayEvents = computed(() => selectedDay.value ? getEventsForDay(selectedDay.value) : [])

function createOnSelectedDay() {
  if (!selectedDay.value) return
  selectedDate.value = toDateStr(selectedDay.value)
  selectedEndDate.value = ''
  editingEvent.value = null
  showDaySheet.value = false
  showModal.value = true
}

function editFromSheet(evt: any) {
  showDaySheet.value = false
  openEditEvent(evt)
}

function openEditEvent(evt: any) {
  const start = evt.start_time?.split('T')[0] || ''
  const end = evt.end_time?.split('T')[0] || ''
  editingEvent.value = { ...evt }
  selectedDate.value = start
  selectedEndDate.value = end !== start ? end : ''
  showModal.value = true
}

function onSubmitEvent() {
  if (!eventFormRef.value) return
  const fd = new FormData(eventFormRef.value)
  const startDate = fd.get('start_date') as string
  const endDate = fd.get('end_date') as string
  const startTime = fd.get('start_time') as string
  const allDay = fd.get('all_day') === 'on'
  const hasEnd = endDate && endDate !== startDate

  handleSave({
    title: fd.get('title'),
    description: fd.get('description'),
    event_type: fd.get('event_type'),
    start_time: allDay ? startDate + 'T00:00:00.000Z' : startDate + 'T' + (startTime || '00:00') + ':00.000Z',
    end_time: hasEnd ? endDate + 'T23:59:59.000Z' : (allDay ? null : startDate + 'T23:59:00.000Z'),
    all_day: allDay,
    alert_before: parseInt(fd.get('alert_before') as string) || 0,
    color: fd.get('color'),
    location: fd.get('location'),
    created_by: parseInt(fd.get('created_by') as string) || 1,
  })
}

async function handleSave(data: any) {
  try {
    if (editingEvent.value) await updateEvent(editingEvent.value.id, data)
    else await createEvent(data)
  } catch (e: any) {
    alert('Erreur : ' + (e?.data?.message || 'impossible de sauvegarder'))
    return
  }
  showModal.value = false; editingEvent.value = null
  await loadData()
}

// Suppression en 2 temps (anti-erreur sur mobile) : 1er tap = confirmation
function askDelete(id: number) {
  confirmingDelete.value = confirmingDelete.value === id ? null : id
}

async function handleDelete(id: number) {
  await deleteEvent(id)
  confirmingDelete.value = null
  await loadData()
}

function closeModal() {
  showModal.value = false
  editingEvent.value = null
}

const upcomingEvents = computed(() => {
  const todayStr = toDateStr(new Date())
  return events.value
    .filter((e: any) => {
      const start = e.start_time?.split('T')[0] || ''
      const end = e.end_time?.split('T')[0] || ''
      if (end && end !== start) return end >= todayStr // événement multi-jours pas terminé
      return start >= todayStr
    })
    .sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''))
    .slice(0, 20)
})

function formatTime(s: string) { if (!s) return ''; return new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
function formatDateNice(s: string) { if (!s) return ''; return new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }
function formatDateRange(evt: any) {
  const start = evt.start_time?.split('T')[0]
  const end = evt.end_time?.split('T')[0]
  if (!start) return ''
  const s = new Date(start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  if (end && end !== start) {
    const e = new Date(end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return `${s} → ${e}`
  }
  return new Date(start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

watch([currentMonth, currentYear], () => loadData())
onMounted(loadData)
onUnmounted(() => ctx?.revert())
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-6 sm:py-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Icon icon="lucide:calendar-days" class="w-6 sm:w-7 h-6 sm:h-7 text-lavender" />
          Calendrier
        </h1>
        <p class="text-text-muted text-xs sm:text-sm mt-1">
          Nos disponibilités, sorties et rappels
          <NuxtLink to="/sync" class="ml-3 text-xs text-lavender hover:text-lavender-soft underline inline-flex items-center gap-1">
            <Icon icon="lucide:smartphone" class="w-3 h-3" /> Sync calendrier
          </NuxtLink>
        </p>
      </div>
      <button @click="showModal = true; editingEvent = null; selectedDate = toDateStr(new Date()); selectedEndDate = ''"
        class="self-start sm:self-auto px-5 py-2.5 bg-gradient-to-r from-lavender to-rose rounded-xl text-white font-semibold text-sm hover:scale-105 transition-transform duration-300 shadow-lg shadow-lavender/20 flex items-center gap-2">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouvel événement
      </button>
    </div>

    <!-- Month nav -->
    <div class="flex items-center justify-between mb-4">
      <button @click="prevMonth" class="p-2.5 rounded-xl bg-surface border border-border text-text hover:bg-surface2 transition-colors" aria-label="Mois précédent">
        <Icon icon="lucide:chevron-left" class="w-4 h-4" />
      </button>
      <h2 class="text-lg sm:text-xl font-bold">{{ monthNames[currentMonth] }} {{ currentYear }}</h2>
      <button @click="nextMonth" class="p-2.5 rounded-xl bg-surface border border-border text-text hover:bg-surface2 transition-colors" aria-label="Mois suivant">
        <Icon icon="lucide:chevron-right" class="w-4 h-4" />
      </button>
    </div>

    <!-- Calendar grid -->
    <div ref="calGridRef" class="bg-surface border border-border rounded-2xl overflow-hidden">
      <div class="grid grid-cols-7 border-b border-border">
        <div v-for="day in dayNames" :key="day" class="py-2 sm:p-3 text-center text-[10px] sm:text-xs font-semibold text-text-muted">{{ day }}</div>
      </div>
      <div class="grid grid-cols-7">
        <div v-for="(day, i) in calendarDays" :key="i" @click="handleDayClick(day.date)"
          class="cal-day min-h-[52px] sm:min-h-[90px] p-0.5 sm:p-2 border-b border-r border-border/50 cursor-pointer hover:bg-surface2/50 transition-colors relative select-none"
          :class="{ 'opacity-30': !day.isCurrentMonth, 'bg-lavender/5': day.isToday }">
          <div class="flex items-center justify-center sm:justify-between mb-0.5">
            <span class="text-[11px] sm:text-xs font-medium w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center"
              :class="day.isToday ? 'bg-lavender text-white rounded-full' : 'text-text-muted'">
              {{ day.date.getDate() }}
            </span>
            <span v-if="dayEventsCount(day.date) > 0" class="hidden sm:inline text-[9px] text-text-muted">{{ dayEventsCount(day.date) }}</span>
          </div>
          <div class="space-y-0.5 hidden sm:block">
            <div v-for="evt in getEventsForDay(day.date).slice(0, 3)" :key="evt.id" @click.stop="openEditEvent(evt)"
              class="text-[10px] px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:brightness-110 transition-all flex items-center gap-1"
              :style="{ background: (evt.color || '#a78bfa') + '20', color: evt.color || '#a78bfa' }" :title="evt.title">
              <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-2.5 h-2.5 flex-shrink-0" />
              {{ evt.title }}
            </div>
          </div>
          <!-- Mobile : pastilles colorées -->
          <div v-if="dayEventsCount(day.date) > 0" class="sm:hidden flex justify-center gap-0.5 mt-1 flex-wrap px-0.5">
            <div v-for="(evt, ei) in getEventsForDay(day.date).slice(0, 4)" :key="ei"
              class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ background: evt.color || '#a78bfa' }" />
          </div>
        </div>
      </div>
    </div>
    <p class="text-center text-[11px] text-text-muted mt-2 sm:hidden">Tape sur un jour pour voir et ajouter des événements</p>

    <!-- Events list -->
    <div class="mt-8">
      <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
        <Icon icon="lucide:list" class="w-5 h-5 text-lavender" /> Événements à venir
      </h3>
      <div v-if="loading" class="text-center py-12 text-text-muted">
        <Icon icon="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin mb-3" /> Chargement...
      </div>
      <div v-else-if="upcomingEvents.length === 0" class="text-center py-12 text-text-muted bg-surface border border-border rounded-2xl">
        <Icon icon="lucide:calendar-off" class="w-10 h-10 mx-auto mb-2 opacity-40" /><p>Aucun événement à venir</p>
      </div>
      <div v-else class="space-y-2">
        <TransitionGroup name="list">
          <div v-for="evt in upcomingEvents" :key="evt.id" @click="openEditEvent(evt)"
            class="event-row flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-surface border border-border rounded-xl hover:border-lavender/30 transition-all duration-200 cursor-pointer group">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: (evt.color || '#a78bfa') + '15' }">
              <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-4 h-4 sm:w-5 sm:h-5" :style="{ color: evt.color || '#a78bfa' }" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm truncate">{{ evt.title }}</p>
              <p class="text-xs text-text-muted mt-0.5">{{ formatDateRange(evt) }}<span v-if="formatTime(evt.start_time)"> · {{ formatTime(evt.start_time) }}</span></p>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-muted items-center gap-1 hidden sm:flex">
              <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-3 h-3" />
              {{ eventTypes[evt.event_type]?.label || 'Événement' }}
            </span>
            <!-- Delete : toujours visible sur mobile, hover sur desktop -->
            <button v-if="confirmingDelete === evt.id" @click.stop="handleDelete(evt.id)"
              class="px-2.5 py-1.5 rounded-lg bg-rose/15 text-rose text-xs font-semibold flex-shrink-0">
              Confirmer ?
            </button>
            <button v-else @click.stop="askDelete(evt.id)"
              class="text-text-muted hover:text-rose transition-all duration-200 p-1.5 flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Supprimer">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- Day sheet (mobile-first : détails du jour) -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showDaySheet" class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showDaySheet = false" />
          <div class="relative w-full sm:max-w-md bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80dvh] overflow-y-auto pb-safe-lg">
            <div class="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between z-10">
              <div>
                <p class="font-bold">{{ selectedDay ? formatDateNice(toDateStr(selectedDay)) : '' }}</p>
                <p class="text-xs text-text-muted mt-0.5">{{ selectedDayEvents.length }} événement{{ selectedDayEvents.length > 1 ? 's' : '' }}</p>
              </div>
              <button @click="showDaySheet = false" class="p-2 rounded-xl hover:bg-surface2 transition-colors" aria-label="Fermer">
                <Icon icon="lucide:x" class="w-4 h-4" />
              </button>
            </div>

            <div class="p-5 space-y-2">
              <div v-if="selectedDayEvents.length === 0" class="text-center py-8 text-text-muted">
                <Icon icon="lucide:calendar-off" class="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p class="text-sm">Rien de prévu ce jour-là</p>
              </div>
              <div v-for="evt in selectedDayEvents" :key="evt.id" @click="editFromSheet(evt)"
                class="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface2/50 hover:border-lavender/30 transition-colors cursor-pointer">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: (evt.color || '#a78bfa') + '15' }">
                  <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-4 h-4" :style="{ color: evt.color || '#a78bfa' }" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ evt.title }}</p>
                  <p class="text-[11px] text-text-muted truncate">
                    {{ eventTypes[evt.event_type]?.label || 'Événement' }}<template v-if="formatTime(evt.start_time)"> · {{ formatTime(evt.start_time) }}</template>
                  </p>
                </div>
                <button v-if="confirmingDelete === evt.id" @click.stop="handleDelete(evt.id)"
                  class="px-2.5 py-1.5 rounded-lg bg-rose/15 text-rose text-xs font-semibold flex-shrink-0">
                  Confirmer ?
                </button>
                <button v-else @click.stop="askDelete(evt.id)" class="p-1.5 text-text-muted hover:text-rose transition-colors flex-shrink-0" aria-label="Supprimer">
                  <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
                </button>
              </div>

              <button @click="createOnSelectedDay"
                class="w-full py-3 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm flex items-center justify-center gap-2 mt-3">
                <Icon icon="lucide:plus" class="w-4 h-4" /> Ajouter un événement ce jour
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal événement (bottom-sheet sur mobile) -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="closeModal" />
          <div class="relative w-full sm:max-w-md bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe-lg">
            <h3 class="text-lg font-bold mb-4">
              {{ editingEvent ? 'Modifier' : (selectedEndDate ? 'Nouvel événement multi-jours' : 'Nouvel événement') }}
            </h3>
            <form ref="eventFormRef" @submit.prevent="onSubmitEvent" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Titre *</label>
                <input name="title" required :value="editingEvent?.title || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors"
                  :placeholder="selectedEndDate ? 'ex: Week-end à Rome' : 'ex: Soirée netflix'" />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Description</label>
                <textarea name="description" rows="2" :value="editingEvent?.description || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors resize-none" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Type</label>
                  <select name="event_type" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                    <option v-for="(et, key) in eventTypes" :key="key" :value="key"
                      :selected="(editingEvent?.event_type || (selectedEndDate ? 'trip' : 'event')) === key">
                      {{ et.label }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Couleur</label>
                  <div class="flex gap-2 mt-1.5">
                    <label v-for="c in colorOptions" :key="c" class="cursor-pointer">
                      <input type="radio" name="color" :value="c" class="hidden peer" :checked="(editingEvent?.color || '#a78bfa') === c" />
                      <div class="w-7 h-7 rounded-full border-2 transition-all peer-checked:border-white peer-checked:scale-110" :style="{ background: c, borderColor: (editingEvent?.color || '#a78bfa') === c ? 'white' : 'transparent' }" />
                    </label>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input type="checkbox" name="all_day" id="all_day_evt" :checked="editingEvent?.all_day" class="rounded accent-lavender" />
                <label for="all_day_evt" class="text-sm text-text-muted cursor-pointer">Toute la journée</label>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Du *</label>
                  <input type="date" name="start_date" required :value="editingEvent?.start_time?.split('T')[0] || selectedDate || toDateStr(new Date())"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Au</label>
                  <input type="date" name="end_date"
                    :value="editingEvent?.end_time?.split('T')[0] || selectedEndDate || editingEvent?.start_time?.split('T')[0] || selectedDate || toDateStr(new Date())"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Heure (optionnel)</label>
                <input type="time" name="start_time"
                  :value="editingEvent?.start_time?.split('T')[1]?.slice(0, 5) || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors" />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Lieu</label>
                <input name="location" :value="editingEvent?.location || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Alerte</label>
                <select name="alert_before" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                  <option value="0" :selected="!editingEvent?.alert_before">Pas d'alerte</option>
                  <option value="15" :selected="editingEvent?.alert_before === 15">15 min avant</option>
                  <option value="30" :selected="editingEvent?.alert_before === 30">30 min avant</option>
                  <option value="60" :selected="editingEvent?.alert_before === 60">1 heure avant</option>
                  <option value="1440" :selected="editingEvent?.alert_before === 1440">1 jour avant</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Créé par</label>
                <select name="created_by" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                  <option v-for="u in users" :key="u.id" :value="u.id" :selected="(editingEvent?.created_by || 1) === u.id">{{ u.name }}</option>
                </select>
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" @click="closeModal"
                  class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
                <button type="submit"
                  class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                  <Icon :icon="editingEvent ? 'lucide:save' : 'lucide:plus'" class="w-4 h-4" />
                  {{ editingEvent ? 'Enregistrer' : 'Créer' }}
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
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from { opacity: 0; transform: translateY(8px); }
.list-leave-to { opacity: 0; transform: scale(0.95); }
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
.sheet-enter-active, .sheet-leave-active { transition: all 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from > div:last-child, .sheet-leave-to > div:last-child { transform: translateY(100%); }
</style>
