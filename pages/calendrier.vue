<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

const { fetchEvents, createEvent, deleteEvent, fetchUsers } = useApi()

const events = ref<any[]>([])
const users = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingEvent = ref<any>(null)
const selectedDate = ref('')
const eventFormRef = ref<HTMLFormElement | null>(null)

const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const today = new Date()

const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const eventTypes: Record<string, { icon: string; label: string; color: string }> = {
  date_night: { icon: 'lucide:heart', label: 'Date night', color: '#ff6b8a' },
  availability: { icon: 'lucide:circle-check', label: 'Disponibilité', color: '#4adec0' },
  reminder: { icon: 'lucide:bell', label: 'Rappel', color: '#f0c060' },
  event: { icon: 'lucide:calendar', label: 'Événement', color: '#a78bfa' },
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
    return start === ds || (e.all_day && end && start <= ds && end >= ds)
  })
}

function prevMonth() { if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- } else currentMonth.value-- }
function nextMonth() { if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ } else currentMonth.value++ }

const calGridRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

async function loadData() {
  loading.value = true
  const startDate = new Date(currentYear.value, currentMonth.value - 1, 1)
  const endDate = new Date(currentYear.value, currentMonth.value + 2, 0)
  const [e, u] = await Promise.all([fetchEvents(startDate.toISOString(), endDate.toISOString()), fetchUsers()])
  events.value = e || []
  users.value = u || []
  loading.value = false
  await nextTick()
  ctx?.revert()
  ctx = gsap.context(() => {
    gsap.fromTo('.cal-day', { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.25, stagger: 0.008, ease: 'power2.out' })
    gsap.fromTo('.event-row', { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out', delay: 0.2 })
  })
}

function openCreateForDay(date: Date) { selectedDate.value = toDateStr(date); editingEvent.value = null; showModal.value = true }
function openEditEvent(evt: any) { editingEvent.value = { ...evt }; showModal.value = true }

function onSubmitEvent() {
  if (!eventFormRef.value) return
  const fd = new FormData(eventFormRef.value)
  const startDate = fd.get('start_date') as string
  const startTime = fd.get('start_time') as string
  const allDay = fd.get('all_day') === 'on'
  handleSave({
    title: fd.get('title'),
    description: fd.get('description'),
    event_type: fd.get('event_type'),
    start_time: allDay ? startDate + 'T00:00:00.000Z' : startDate + 'T' + (startTime || '00:00') + ':00.000Z',
    end_time: allDay ? null : startDate + 'T23:59:00.000Z',
    all_day: allDay,
    alert_before: parseInt(fd.get('alert_before') as string) || 0,
    color: fd.get('color'),
    location: fd.get('location'),
    created_by: parseInt(fd.get('created_by') as string) || 1,
  })
}

async function handleSave(data: any) {
  if (editingEvent.value) await deleteEvent(editingEvent.value.id)
  await createEvent(data)
  showModal.value = false; editingEvent.value = null
  await loadData()
}

async function handleDelete(id: number) { await deleteEvent(id); await loadData() }

function formatTime(s: string) { if (!s) return ''; return new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
function formatDateNice(s: string) { if (!s) return ''; return new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }

watch([currentMonth, currentYear], loadData)
onMounted(loadData)
onUnmounted(() => ctx?.revert())
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <Icon icon="lucide:calendar-days" class="w-7 h-7 text-lavender" />
          Calendrier
        </h1>
        <p class="text-text-muted text-sm mt-1">Nos disponibilités, sorties et rappels</p>
      </div>
      <button @click="showModal = true; editingEvent = null; selectedDate = toDateStr(new Date())"
        class="px-5 py-2.5 bg-gradient-to-r from-lavender to-rose rounded-xl text-white font-semibold text-sm hover:scale-105 transition-transform duration-300 shadow-lg shadow-lavender/20 flex items-center gap-2">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouvel événement
      </button>
    </div>

    <!-- Month nav -->
    <div class="flex items-center justify-between mb-4">
      <button @click="prevMonth" class="p-2.5 rounded-xl bg-surface border border-border text-text hover:bg-surface2 transition-colors">
        <Icon icon="lucide:chevron-left" class="w-4 h-4" />
      </button>
      <h2 class="text-xl font-bold">{{ monthNames[currentMonth] }} {{ currentYear }}</h2>
      <button @click="nextMonth" class="p-2.5 rounded-xl bg-surface border border-border text-text hover:bg-surface2 transition-colors">
        <Icon icon="lucide:chevron-right" class="w-4 h-4" />
      </button>
    </div>

    <!-- Calendar grid -->
    <div ref="calGridRef" class="bg-surface border border-border rounded-2xl overflow-hidden">
      <div class="grid grid-cols-7 border-b border-border">
        <div v-for="day in dayNames" :key="day" class="p-3 text-center text-xs font-semibold text-text-muted">{{ day }}</div>
      </div>
      <div class="grid grid-cols-7">
        <div v-for="(day, i) in calendarDays" :key="i" @dblclick="openCreateForDay(day.date)"
          class="cal-day min-h-[90px] p-2 border-b border-r border-border/50 cursor-pointer hover:bg-surface2/50 transition-colors relative"
          :class="{ 'opacity-30': !day.isCurrentMonth, 'bg-lavender/5': day.isToday }">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-medium" :class="day.isToday ? 'bg-lavender text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-text-muted'">
              {{ day.date.getDate() }}
            </span>
          </div>
          <div class="space-y-0.5">
            <div v-for="evt in getEventsForDay(day.date).slice(0, 3)" :key="evt.id" @click.stop="openEditEvent(evt)"
              class="text-[10px] px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:brightness-110 transition-all flex items-center gap-1"
              :style="{ background: (evt.color || '#a78bfa') + '20', color: evt.color || '#a78bfa' }" :title="evt.title">
              <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-2.5 h-2.5 flex-shrink-0" />
              {{ evt.title }}
            </div>
            <div v-if="getEventsForDay(day.date).length > 3" class="text-[10px] text-text-muted px-1.5">
              +{{ getEventsForDay(day.date).length - 3 }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Events list -->
    <div class="mt-8">
      <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
        <Icon icon="lucide:list" class="w-5 h-5 text-lavender" /> Événements à venir
      </h3>
      <div v-if="loading" class="text-center py-12 text-text-muted">
        <Icon icon="lucide:loader-circle" class="w-8 h-8 mx-auto animate-spin mb-3" /> Chargement...
      </div>
      <div v-else-if="events.length === 0" class="text-center py-12 text-text-muted bg-surface border border-border rounded-2xl">
        <Icon icon="lucide:calendar-off" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Aucun événement</p>
      </div>
      <div v-else class="space-y-2">
        <TransitionGroup name="list">
          <div v-for="evt in events.slice(0, 20)" :key="evt.id" @click="openEditEvent(evt)"
            class="event-row flex items-center gap-4 p-4 bg-surface border border-border rounded-xl hover:border-lavender/30 transition-all duration-200 cursor-pointer group">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: (evt.color || '#a78bfa') + '15' }">
              <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-5 h-5" :style="{ color: evt.color || '#a78bfa' }" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm">{{ evt.title }}</p>
              <p v-if="evt.description" class="text-xs text-text-muted mt-0.5 truncate">{{ evt.description }}</p>
              <p class="text-xs text-text-muted mt-1">
                {{ formatDateNice(evt.start_time) }}
                <span v-if="evt.start_time && !evt.all_day"> à {{ formatTime(evt.start_time) }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-muted flex items-center gap-1">
                <Icon :icon="eventTypes[evt.event_type]?.icon || 'lucide:calendar'" class="w-3 h-3" />
                {{ eventTypes[evt.event_type]?.label || 'Événement' }}
              </span>
              <button @click.stop="handleDelete(evt.id)"
                class="opacity-0 group-hover:opacity-100 text-text-muted hover:text-rose transition-all duration-200 p-1">
                <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold mb-4">{{ editingEvent ? 'Modifier' : 'Nouvel événement' }}</h3>
            <form ref="eventFormRef" @submit.prevent="onSubmitEvent" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Titre *</label>
                <input name="title" required :value="editingEvent?.title || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors" />
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
                    <option v-for="(et, key) in eventTypes" :key="key" :value="key" :selected="(editingEvent?.event_type || 'event') === key">
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
                <input type="checkbox" name="all_day" id="all_day_evt" :checked="editingEvent?.all_day" class="rounded" />
                <label for="all_day_evt" class="text-sm text-text-muted">Toute la journée</label>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Date *</label>
                  <input type="date" name="start_date" required :value="editingEvent?.start_time?.split('T')[0] || selectedDate"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Heure</label>
                  <input type="time" name="start_time" :value="editingEvent?.start_time?.split('T')[1]?.slice(0, 5) || ''"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
                </div>
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
                <button type="button" @click="showModal = false"
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
</style>
