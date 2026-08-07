<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

// Hardcoded
const account = { id: 4, name: 'Aksel', color: '#4da6ff', partner: { id: 5, name: 'Amandine', color: '#ff6b8a' } }
const activeTab = ref('mood')

const tabs = [
  { id: 'mood', icon: 'lucide:smile', label: 'Mood' },
  { id: 'notes', icon: 'lucide:heart', label: 'Messages' },
  { id: 'timeline', icon: 'lucide:clock', label: 'Timeline' },
  { id: 'spots', icon: 'lucide:map-pin', label: 'Date Spots' },
  { id: 'gifts', icon: 'lucide:gift', label: 'Cadeaux' },
  { id: 'trips', icon: 'lucide:plane', label: 'Voyages' },
]

// ---- Mood ----
const moods = ['😍', '😊', '🤪', '🥱', '😤', '🥺', '😴']
const moodLabels: Record<string, string> = { '😍': 'Amoureux(se)', '😊': 'Content(e)', '🤪': 'Joueur(se)', '🥱': 'Fatigué(e)', '😤': 'Stressé(e)', '🥺': 'Nostalgique', '😴': 'Envie de rien' }
const todayMoods = ref<any[]>([])
const selectedMood = ref('')

async function loadMoods() {
  try { todayMoods.value = await $fetch('/api/moods') } catch { todayMoods.value = [] }
  const mine = todayMoods.value.find((m: any) => m.account_id === account.id)
  selectedMood.value = mine?.mood || ''
}
async function setMood(mood: string) {
  selectedMood.value = mood
  await $fetch('/api/moods', { method: 'POST', body: { mood } })
  await loadMoods()
}

// ---- Messages chat ----
const { identity: chatIdentity, showPicker: showChatPicker, load: loadChatIdentity, pick: pickChatIdentity } = useChatIdentity()
const chatMessages = ref<any[]>([])
const newChatMsg = ref('')
const chatRef = ref<HTMLElement | null>(null)
let chatTimer: ReturnType<typeof setInterval> | null = null

const myChatId = computed(() => chatIdentity.value?.id || 0)
const myChatName = computed(() => chatIdentity.value?.name || '')
const myChatColor = computed(() => chatIdentity.value?.color || '#a78bfa')

async function loadChatMessages(since?: number) {
  try {
    const url = since ? `/api/messages?since=${since}` : '/api/messages'
    const data = await $fetch(url)
    if (since) {
      const existing = new Set(chatMessages.value.map(m => m.id))
      for (const m of data) { if (!existing.has(m.id)) chatMessages.value.push(m) }
    } else {
      chatMessages.value = data
    }
    await nextTick()
    scrollChatBottom()
  } catch { /* ok */ }
}

async function sendChatMessage() {
  const text = newChatMsg.value.trim()
  if (!text || !chatIdentity.value) return
  try {
    const sent = await $fetch('/api/messages', { method: 'POST', body: { message: text, from_id: chatIdentity.value.id } })
    chatMessages.value.push(sent)
    newChatMsg.value = ''
    await nextTick(); scrollChatBottom()
  } catch { /* garde le texte */ }
}

function changeChatIdentity() {
  const { clear } = useChatIdentity()
  clear()
  stopChatPolling()
}

function scrollChatBottom() {
  nextTick(() => { if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight })
}

function chatTime(d: string) { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }

function chatDate(d: string) {
  const date = new Date(d); const today = new Date()
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui"
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const groupedChat = computed(() => {
  const groups: { date: string; messages: any[] }[] = []; let lastDate = ''
  for (const m of chatMessages.value) {
    const d = m.created_at?.split('T')[0]
    if (d !== lastDate) { groups.push({ date: d, messages: [m] }); lastDate = d }
    else { groups[groups.length - 1].messages.push(m) }
  }
  return groups
})

function startChatPolling() {
  chatTimer = setInterval(async () => {
    const lastId = chatMessages.value.length > 0 ? chatMessages.value[chatMessages.value.length - 1].id : 0
    await loadChatMessages(lastId)
  }, 3000)
}

function stopChatPolling() { if (chatTimer) { clearInterval(chatTimer); chatTimer = null } }

// ---- Timeline ----
const memories = ref<any[]>([])
const showMemForm = ref(false)
const memTitle = ref('')
const memDate = ref('')
const memDesc = ref('')
async function loadMemories() {
  try { memories.value = await $fetch('/api/memories') } catch { memories.value = [] }
}
async function addMemory() {
  if (!memTitle.value.trim() || !memDate.value) return
  await $fetch('/api/memories', { method: 'POST', body: { title: memTitle.value, date: memDate.value, description: memDesc.value } })
  memTitle.value = ''; memDate.value = ''; memDesc.value = ''; showMemForm.value = false
  await loadMemories()
}
async function deleteMemory(id: number) {
  await $fetch(`/api/memories?id=${id}`, { method: 'DELETE' })
  await loadMemories()
}
function formatMemDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ---- Date Spots ----
const spots = ref<any[]>([])
const categories = ['restaurant', 'bar', 'cafe', 'nature', 'culture', 'activity', 'other']
const catIcons: Record<string, string> = { restaurant: 'lucide:utensils', bar: 'lucide:wine', cafe: 'lucide:coffee', nature: 'lucide:trees', culture: 'lucide:landmark', activity: 'lucide:bike', other: 'lucide:map-pin' }
const catLabels: Record<string, string> = { restaurant: 'Restaurant', bar: 'Bar', cafe: 'Café', nature: 'Nature', culture: 'Culture', activity: 'Activité', other: 'Autre' }
const spotFilter = ref('')
const showSpotForm = ref(false)
const spotName = ref(''); const spotCat = ref('restaurant'); const spotNotes = ref(''); const spotRating = ref(0); const spotLat = ref(''); const spotLng = ref('')
async function loadSpots() {
  try { spots.value = await $fetch('/api/spots') } catch { spots.value = [] }
}
const filteredSpots = computed(() => spots.value.filter((s: any) => !spotFilter.value || s.category === spotFilter.value))
async function addSpot() {
  if (!spotName.value.trim()) return
  await $fetch('/api/spots', { method: 'POST', body: { name: spotName.value, category: spotCat.value, rating: spotRating.value || null, notes: spotNotes.value, lat: spotLat.value ? parseFloat(spotLat.value) : null, lng: spotLng.value ? parseFloat(spotLng.value) : null } })
  spotName.value = ''; spotNotes.value = ''; spotRating.value = 0; spotLat.value = ''; spotLng.value = ''; showSpotForm.value = false
  await loadSpots()
}
async function toggleVisited(s: any) {
  await $fetch('/api/spots', { method: 'PATCH', body: { id: s.id, visited: !s.visited } })
  await loadSpots()
}
async function deleteSpot(id: number) {
  await $fetch(`/api/spots?id=${id}`, { method: 'DELETE' })
  await loadSpots()
}
function renderStars(r: number) {
  return Array.from({ length: 5 }, (_, i) => i < r ? '★' : '☆').join('')
}

// ---- Gifts ----
const gifts = ref<any[]>([])
const showGiftForm = ref(false)
const giftTitle = ref(''); const giftLink = ref(''); const giftNotes = ref(''); const giftSurprise = ref(false)
async function loadGifts() {
  try { gifts.value = await $fetch('/api/gifts') } catch { gifts.value = [] }
}
async function addGift() {
  if (!giftTitle.value.trim()) return
  await $fetch('/api/gifts', { method: 'POST', body: { title: giftTitle.value, link: giftLink.value, notes: giftNotes.value, surprise: giftSurprise.value } })
  giftTitle.value = ''; giftLink.value = ''; giftNotes.value = ''; giftSurprise.value = false; showGiftForm.value = false
  await loadGifts()
}
async function deleteGift(id: number) {
  await $fetch(`/api/gifts?id=${id}`, { method: 'DELETE' })
  await loadGifts()
}

// ---- Trips ----
const trips = ref<any[]>([])
const showTripForm = ref(false)
const tripTitle = ref(''); const tripDest = ref(''); const tripDesc = ref(''); const tripStart = ref(''); const tripEnd = ref('')
async function loadTrips() {
  try { trips.value = await $fetch('/api/proposals') } catch { trips.value = [] }
}
async function addTrip() {
  if (!tripTitle.value.trim()) return
  await $fetch('/api/proposals', { method: 'POST', body: { title: tripTitle.value, destination: tripDest.value, description: tripDesc.value, start_date: tripStart.value || null, end_date: tripEnd.value || null } })
  tripTitle.value = ''; tripDest.value = ''; tripDesc.value = ''; tripStart.value = ''; tripEnd.value = ''; showTripForm.value = false
  await loadTrips()
}
async function respondTrip(id: number, status: string) {
  await $fetch('/api/proposals', { method: 'PATCH', body: { id, status } })
  await loadTrips()
}
async function deleteTrip(id: number) {
  await $fetch(`/api/proposals?id=${id}`, { method: 'DELETE' })
  await loadTrips()
}
function formatTripDate(d: string) { if (!d) return ''; return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }

onMounted(async () => {
  loadChatIdentity()
  await Promise.all([loadMoods(), loadMemories(), loadSpots(), loadGifts(), loadTrips()])
  nextTick(() => {
    gsap.fromTo('.moment-card', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' })
  })
})

// Switch tab + refresh
watch(activeTab, async (tab) => {
  if (tab === 'mood') await loadMoods()
  if (tab === 'notes' && chatIdentity.value) await loadChatMessages()
  if (tab === 'timeline') await loadMemories()
  if (tab === 'spots') await loadSpots()
  if (tab === 'gifts') await loadGifts()
  if (tab === 'trips') await loadTrips()
  nextTick(() => {
    gsap.fromTo('.moment-card', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' })
  })
})

// Poll chat when messages tab is active AND identity chosen
watch([activeTab, chatIdentity], ([tab, id]) => {
  if (tab === 'notes' && id) startChatPolling()
  else stopChatPolling()
})

onUnmounted(() => { stopChatPolling() })
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:sparkles" class="w-6 sm:w-7 h-6 sm:h-7 text-gold" /> Moments
      </h1>
      <p class="text-text-muted text-sm">Vos souvenirs, vos sorties, vos petits mots</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 overflow-x-auto pb-1">
      <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
        :class="activeTab === t.id ? 'bg-gold/15 text-gold border border-gold/30' : 'text-text-muted hover:text-text hover:bg-surface2 border border-transparent'">
        <Icon :icon="t.icon" class="w-4 h-4" /> {{ t.label }}
      </button>
    </div>

    <!-- ========= MOOD ========= -->
    <div v-if="activeTab === 'mood'">
      <div class="moment-card bg-surface border border-border rounded-2xl p-6 text-center mb-4">
        <p class="text-sm text-text-muted mb-4">Comment tu te sens aujourd'hui, {{ account?.name }} ?</p>
        <div class="flex flex-wrap justify-center gap-3">
          <button v-for="m in moods" :key="m" @click="setMood(m)"
            class="w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all text-2xl"
            :class="selectedMood === m ? 'bg-gold/15 border-2 border-gold scale-110' : 'bg-surface2 border-2 border-transparent hover:border-border hover:scale-105'">
            {{ m }}
            <span class="text-[10px] text-text-muted mt-0.5">{{ moodLabels[m] }}</span>
          </button>
        </div>
      </div>

      <div v-if="todayMoods.length > 0" class="moment-card bg-surface border border-border rounded-2xl p-5">
        <p class="text-xs font-semibold text-text-muted uppercase mb-3">Aujourd'hui</p>
        <div class="flex gap-6 justify-center">
          <div v-for="m in todayMoods" :key="m.account_id" class="text-center">
            <div class="text-4xl mb-1">{{ m.mood }}</div>
            <p class="text-sm font-medium" :style="{ color: m.color }">{{ m.name }}</p>
            <p class="text-xs text-text-muted">{{ moodLabels[m.mood] }}</p>
          </div>
        </div>
      </div>
      <p v-else class="text-center text-text-muted text-sm mt-6">Pas encore de mood aujourd'hui... 😴</p>
    </div>

    <!-- ========= MESSAGES CHAT ========= -->
    <div v-if="activeTab === 'notes'" class="flex flex-col" style="height: calc(100vh - 280px); min-height: 400px;">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3 flex-shrink-0">
        <p class="text-sm font-semibold text-text-muted">Chat en direct</p>
        <button v-if="chatIdentity" @click="changeChatIdentity"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-border hover:bg-surface2 transition-colors"
          :style="{ color: myChatColor }">
          <div class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" :style="{ background: myChatColor }">
            {{ myChatName.charAt(0) }}
          </div>
          {{ myChatName }}
          <Icon icon="lucide:chevron-down" class="w-3 h-3" />
        </button>
      </div>

      <!-- Messages area -->
      <div ref="chatRef" class="flex-1 overflow-y-auto space-y-5 mb-4 px-1 scroll-smooth">
        <div v-if="!chatIdentity" class="flex items-center justify-center h-full">
          <div class="text-center text-text-muted">
            <Icon icon="lucide:user" class="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p class="text-sm">Choisis ton prénom pour chatter</p>
          </div>
        </div>
        <div v-else-if="chatMessages.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center text-text-muted">
            <Icon icon="lucide:messages-square" class="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p class="text-sm">Pas encore de messages</p>
            <p class="text-xs mt-1">Envoyez un premier message !</p>
          </div>
        </div>

        <div v-for="group in groupedChat" :key="group.date" class="space-y-1">
          <div class="flex justify-center mb-3">
            <span class="text-[11px] text-text-muted bg-surface px-3 py-1 rounded-full border border-border">
              {{ chatDate(group.date) }}
            </span>
          </div>

          <div v-for="m in group.messages" :key="m.id"
            class="flex gap-2.5"
            :class="m.from_id === myChatId ? 'justify-end' : 'justify-start'">
            <div v-if="m.from_id !== myChatId"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 self-end"
              :style="{ background: m.from_color || '#ff6b8a' }">
              {{ m.from_name?.charAt(0) }}
            </div>
            <div class="max-w-[75%] sm:max-w-[65%]">
              <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                :class="m.from_id === myChatId
                  ? 'bg-gradient-to-r from-lavender to-rose text-white rounded-br-md'
                  : 'bg-surface2 text-text border border-border rounded-bl-md'">
                {{ m.message }}
              </div>
              <div class="flex items-center gap-1.5 mt-0.5"
                :class="m.from_id === myChatId ? 'justify-end' : 'justify-start'">
                <span class="text-[10px] text-text-muted">{{ chatTime(m.created_at) }}</span>
                <Icon v-if="m.from_id === myChatId && m.read" icon="lucide:check-check" class="w-3 h-3 text-lavender" />
                <Icon v-else-if="m.from_id === myChatId" icon="lucide:check" class="w-3 h-3 text-text-muted" />
              </div>
            </div>
            <div v-if="m.from_id === myChatId"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 self-end"
              :style="{ background: myChatColor }">
              {{ myChatName.charAt(0) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="flex gap-2 flex-shrink-0 pt-3 border-t border-border">
        <input v-if="chatIdentity" v-model="newChatMsg" @keyup.enter="sendChatMessage"
          :placeholder="`Écris en tant que ${myChatName}...`"
          class="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors" />
        <input v-else disabled placeholder="Choisis ton prénom d'abord" @click="showChatPicker = true"
          class="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text-muted text-sm cursor-pointer" />
        <button @click="sendChatMessage" :disabled="!chatIdentity || !newChatMsg.trim()"
          class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1.5">
          <Icon icon="lucide:send" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- ========= TIMELINE ========= -->
    <div v-if="activeTab === 'timeline'">
      <div class="flex justify-between items-center mb-4">
        <p class="text-sm text-text-muted">{{ memories.length }} souvenir{{ memories.length > 1 ? 's' : '' }}</p>
        <button @click="showMemForm = !showMemForm"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-semibold hover:scale-105 transition-transform flex items-center gap-1.5">
          <Icon icon="lucide:plus" class="w-4 h-4" /> Ajouter
        </button>
      </div>

      <Transition name="fade">
        <div v-if="showMemForm" class="moment-card bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
          <input v-model="memTitle" placeholder="Titre (ex: Premier baiser)" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
          <div class="grid grid-cols-2 gap-3">
            <input v-model="memDate" type="date" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
          </div>
          <textarea v-model="memDesc" rows="2" placeholder="Un petit détail..." class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none resize-none" />
          <div class="flex gap-3">
            <button @click="showMemForm = false" class="flex-1 py-2 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2">Annuler</button>
            <button @click="addMemory" class="flex-1 py-2 rounded-xl bg-gradient-to-r from-gold to-rose text-white font-semibold text-sm">Sauvegarder</button>
          </div>
        </div>
      </Transition>

      <div v-if="memories.length === 0" class="text-center py-8 text-text-muted">
        <Icon icon="lucide:clock" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Aucun souvenir... commencez votre timeline !</p>
      </div>
      <div v-else class="relative pl-8 border-l-2 border-border ml-3 space-y-4">
        <div v-for="m in memories" :key="m.id" class="moment-card relative">
          <div class="absolute -left-[33px] top-2 w-4 h-4 rounded-full border-2 border-gold bg-dark" />
          <div class="bg-surface border border-border rounded-2xl p-4 hover:border-gold/20 transition-colors">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <p class="text-sm font-semibold">{{ m.title }}</p>
                <p class="text-xs text-gold font-medium mt-0.5">{{ formatMemDate(m.date) }}</p>
                <p v-if="m.description" class="text-sm text-text-muted mt-1.5">{{ m.description }}</p>
              </div>
              <button @click="deleteMemory(m.id)" class="text-text-muted hover:text-rose transition-colors ml-3">
                <Icon icon="lucide:trash-2" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========= DATE SPOTS ========= -->
    <div v-if="activeTab === 'spots'">
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <div class="flex gap-1 overflow-x-auto">
          <button v-for="c in categories" :key="c" @click="spotFilter = spotFilter === c ? '' : c"
            class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            :class="spotFilter === c ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-surface border border-border text-text-muted hover:text-text'">
            <Icon :icon="catIcons[c]" class="w-3 h-3 inline mr-1" />{{ catLabels[c] }}
          </button>
        </div>
        <button @click="showSpotForm = !showSpotForm"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-semibold hover:scale-105 transition-transform flex items-center gap-1.5 justify-center flex-shrink-0">
          <Icon icon="lucide:plus" class="w-4 h-4" /> Ajouter
        </button>
      </div>

      <Transition name="fade">
        <div v-if="showSpotForm" class="moment-card bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
          <input v-model="spotName" placeholder="Nom du lieu" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
          <div class="grid grid-cols-2 gap-3">
            <select v-model="spotCat" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
              <option v-for="c in categories" :key="c" :value="c">{{ catLabels[c] }}</option>
            </select>
            <div class="flex items-center gap-1 bg-surface2 border border-border rounded-xl px-4 py-2.5">
              <button v-for="s in 5" :key="s" @click="spotRating = s" class="text-lg" :class="s <= spotRating ? 'text-gold' : 'text-text-muted'">★</button>
            </div>
          </div>
          <textarea v-model="spotNotes" rows="2" placeholder="Notes..." class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none resize-none" />
          <div class="flex gap-3">
            <button @click="showSpotForm = false" class="flex-1 py-2 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2">Annuler</button>
            <button @click="addSpot" class="flex-1 py-2 rounded-xl bg-gradient-to-r from-gold to-rose text-white font-semibold text-sm">Ajouter</button>
          </div>
        </div>
      </Transition>

      <div v-if="filteredSpots.length === 0" class="text-center py-8 text-text-muted">
        <Icon icon="lucide:map-pin" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Aucun spot... ajoutez vos restos et bars préférés !</p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div v-for="s in filteredSpots" :key="s.id" class="moment-card bg-surface border rounded-2xl p-4 transition-all hover:scale-[1.01]"
          :class="s.visited ? 'border-mint/20 bg-mint/5' : 'border-border'">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <Icon :icon="catIcons[s.category]" class="w-4 h-4 text-gold" />
                <p class="text-sm font-semibold truncate">{{ s.name }}</p>
              </div>
              <div class="flex items-center gap-2 text-xs text-text-muted">
                <span class="text-gold text-sm">{{ renderStars(s.rating) }}</span>
                <span class="px-1.5 py-0.5 rounded-md bg-surface2 text-[11px]">{{ catLabels[s.category] }}</span>
              </div>
              <p v-if="s.notes" class="text-xs text-text-muted mt-1.5 line-clamp-2">{{ s.notes }}</p>
            </div>
            <div class="flex items-center gap-1 ml-3 flex-shrink-0">
              <button @click="toggleVisited(s)" class="p-1.5 rounded-lg transition-colors"
                :class="s.visited ? 'text-mint bg-mint/10' : 'text-text-muted hover:text-mint hover:bg-surface2'">
                <Icon :icon="s.visited ? 'lucide:check-circle' : 'lucide:circle'" class="w-4 h-4" />
              </button>
              <button @click="deleteSpot(s.id)" class="p-1.5 rounded-lg text-text-muted hover:text-rose hover:bg-surface2 transition-colors">
                <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========= GIFTS ========= -->
    <div v-if="activeTab === 'gifts'">
      <div class="flex justify-between items-center mb-4">
        <p class="text-sm text-text-muted">{{ gifts.length }} idée{{ gifts.length > 1 ? 's' : '' }} cadeau{{ gifts.length > 1 ? 'x' : '' }}</p>
        <button @click="showGiftForm = !showGiftForm"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-semibold hover:scale-105 transition-transform flex items-center gap-1.5">
          <Icon icon="lucide:plus" class="w-4 h-4" /> Ajouter
        </button>
      </div>

      <Transition name="fade">
        <div v-if="showGiftForm" class="moment-card bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
          <input v-model="giftTitle" placeholder="L'idée cadeau" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
          <input v-model="giftLink" placeholder="Lien (optionnel)" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
          <textarea v-model="giftNotes" rows="2" placeholder="Détails, taille, couleur..." class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none resize-none" />
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="giftSurprise" type="checkbox" class="rounded border-border bg-surface2 text-lavender focus:ring-lavender" />
            <span class="text-sm text-text-muted">🤫 Caché (surprise — ton/ta partenaire ne voit pas)</span>
          </label>
          <div class="flex gap-3">
            <button @click="showGiftForm = false" class="flex-1 py-2 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2">Annuler</button>
            <button @click="addGift" class="flex-1 py-2 rounded-xl bg-gradient-to-r from-gold to-rose text-white font-semibold text-sm">Ajouter</button>
          </div>
        </div>
      </Transition>

      <div v-if="gifts.length === 0" class="text-center py-8 text-text-muted">
        <Icon icon="lucide:gift" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Pas d'idées cadeaux... ajoutez-en pour ne pas oublier !</p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div v-for="g in gifts" :key="g.id" class="moment-card bg-surface border rounded-2xl p-4 transition-all hover:scale-[1.01]"
          :class="g.surprise ? 'border-lavender/20 bg-lavender/5' : 'border-border'">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold flex items-center gap-2">
                {{ g.title }}
                <span v-if="g.surprise" class="text-xs">🤫</span>
              </p>
              <p class="text-xs text-text-muted mt-0.5">Ajouté par {{ g.creator_name }}</p>
              <p v-if="g.notes" class="text-xs text-text-muted mt-1 line-clamp-2">{{ g.notes }}</p>
              <a v-if="g.link" :href="g.link" target="_blank" class="text-xs text-lavender hover:text-lavender-soft mt-1 inline-block truncate">{{ g.link }}</a>
            </div>
            <button @click="deleteGift(g.id)" class="p-1.5 rounded-lg text-text-muted hover:text-rose hover:bg-surface2 transition-colors ml-2">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========= TRIPS ========= -->
    <div v-if="activeTab === 'trips'">
      <div class="flex justify-between items-center mb-4">
        <p class="text-sm text-text-muted">{{ trips.length }} proposition{{ trips.length > 1 ? 's' : '' }}</p>
        <button @click="showTripForm = !showTripForm"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-gold to-rose text-white text-sm font-semibold hover:scale-105 transition-transform flex items-center gap-1.5">
          <Icon icon="lucide:plus" class="w-4 h-4" /> Proposer
        </button>
      </div>

      <Transition name="fade">
        <div v-if="showTripForm" class="moment-card bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
          <input v-model="tripTitle" placeholder="Titre (ex: Week-end à Amsterdam)" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
          <input v-model="tripDest" placeholder="Destination (optionnel)" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-text-muted mb-1">Du</label>
              <input v-model="tripStart" type="date" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs text-text-muted mb-1">Au</label>
              <input v-model="tripEnd" type="date" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none" />
            </div>
          </div>
          <textarea v-model="tripDesc" rows="2" placeholder="Description, activités..." class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none resize-none" />
          <div class="flex gap-3">
            <button @click="showTripForm = false" class="flex-1 py-2 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2">Annuler</button>
            <button @click="addTrip" class="flex-1 py-2 rounded-xl bg-gradient-to-r from-gold to-rose text-white font-semibold text-sm">Proposer le voyage</button>
          </div>
        </div>
      </Transition>

      <div v-if="trips.length === 0" class="text-center py-8 text-text-muted">
        <Icon icon="lucide:plane" class="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Pas encore de proposition de voyage</p>
      </div>
      <div v-else class="space-y-3">
        <div v-for="t in trips" :key="t.id" class="moment-card bg-surface border rounded-2xl p-4 transition-all"
          :class="t.status === 'accepted' ? 'border-mint/20 bg-mint/5' : t.status === 'declined' ? 'border-rose/20 bg-rose/5 opacity-60' : 'border-gold/20'">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <Icon icon="lucide:plane" class="w-4 h-4" :class="t.status === 'accepted' ? 'text-mint' : t.status === 'declined' ? 'text-rose' : 'text-gold'" />
                <p class="text-sm font-semibold">{{ t.title }}</p>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  :class="t.status === 'accepted' ? 'bg-mint/10 text-mint' : t.status === 'declined' ? 'bg-rose/10 text-rose' : 'bg-gold/10 text-gold'">
                  {{ t.status === 'accepted' ? '✅ Accepté' : t.status === 'declined' ? '❌ Décliné' : '⏳ En attente' }}
                </span>
              </div>
              <p class="text-xs text-text-muted">Proposé par {{ t.from_name }}</p>
              <div v-if="t.destination" class="flex items-center gap-1 text-xs text-lavender mt-1"><Icon icon="lucide:map-pin" class="w-3 h-3" />{{ t.destination }}</div>
              <div v-if="t.start_date" class="text-xs text-text-muted mt-1">
                {{ formatTripDate(t.start_date) }}<span v-if="t.end_date && t.end_date !== t.start_date"> → {{ formatTripDate(t.end_date) }}</span>
              </div>
              <p v-if="t.description" class="text-xs text-text-muted mt-1 line-clamp-2">{{ t.description }}</p>

              <!-- Accept/Decline (only for receiver when pending) -->
              <div v-if="t.status === 'pending' && t.from_id !== account?.id" class="flex gap-2 mt-3">
                <button @click="respondTrip(t.id, 'accepted')" class="px-4 py-1.5 rounded-lg bg-mint/15 text-mint border border-mint/30 text-xs font-medium hover:bg-mint/20 transition-colors">✅ Accepter</button>
                <button @click="respondTrip(t.id, 'declined')" class="px-4 py-1.5 rounded-lg bg-rose/15 text-rose border border-rose/30 text-xs font-medium hover:bg-rose/20 transition-colors">❌ Décliner</button>
              </div>
            </div>
            <button @click="deleteTrip(t.id)" class="p-1.5 rounded-lg text-text-muted hover:text-rose hover:bg-surface2 transition-colors ml-2">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Identity picker modal (shared for chat tab) -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showChatPicker" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-dark/90 backdrop-blur-md" />
        <div class="relative bg-surface border border-border rounded-2xl w-full max-w-sm p-8 shadow-2xl text-center">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center mx-auto mb-4">
            <Icon icon="lucide:user" class="w-8 h-8 text-white" />
          </div>
          <h2 class="text-xl font-bold mb-1">Qui es-tu ?</h2>
          <p class="text-sm text-text-muted mb-6">Choisis ton prénom pour qu'on sache qui envoie quoi</p>

          <div class="space-y-3">
            <button @click="pickChatIdentity(4, 'Aksel', '#4da6ff')"
              class="w-full p-4 rounded-xl border-2 border-border hover:border-[#4da6ff] hover:bg-[#4da6ff]/5 transition-all flex items-center gap-4 group">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background: #4da6ff">A</div>
              <div class="text-left">
                <p class="font-bold text-sm group-hover:text-[#4da6ff] transition-colors">Aksel</p>
                <p class="text-xs text-text-muted">aksel@nousdeux.fr</p>
              </div>
            </button>

            <button @click="pickChatIdentity(5, 'Amandine', '#ff6b8a')"
              class="w-full p-4 rounded-xl border-2 border-border hover:border-[#ff6b8a] hover:bg-[#ff6b8a]/5 transition-all flex items-center gap-4 group">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background: #ff6b8a">A</div>
              <div class="text-left">
                <p class="font-bold text-sm group-hover:text-[#ff6b8a] transition-colors">Amandine</p>
                <p class="text-xs text-text-muted">amandine@nousdeux.fr</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.9) translateY(20px); }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
