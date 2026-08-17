<script setup lang="ts">
import { nextTick, onMounted, onUnmounted } from 'vue'

definePageMeta({ layout: 'default' })

const { identity, showPicker, load: loadIdentity, pick } = useChatIdentity()

const partner = { id: 5, name: 'Amandine', color: '#ff6b8a' }
const myId = computed(() => identity.value?.id || 0)
const myName = computed(() => identity.value?.name || '')
const myColor = computed(() => identity.value?.color || '#a78bfa')

const messages = ref<any[]>([])
const newMsg = ref('')
const loading = ref(true)
const chatRef = ref<HTMLElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadMessages(since?: number) {
  try {
    const url = since ? `/api/messages?since=${since}` : '/api/messages'
    const data = await $fetch(url)
    if (since) {
      const existing = new Set(messages.value.map(m => m.id))
      for (const m of data) {
        if (!existing.has(m.id)) messages.value.push(m)
      }
    } else {
      messages.value = data
    }
  } catch { /* ignore */ }
  loading.value = false
}

async function sendMessage() {
  const text = newMsg.value.trim()
  if (!text || !identity.value) return
  try {
    const sent = await $fetch('/api/messages', {
      method: 'POST',
      body: { message: text, from_id: identity.value.id }
    })
    messages.value.push(sent)
    newMsg.value = ''
    await nextTick()
    scrollBottom()
  } catch { /* garde le texte */ }
}

const editingId = ref<number | null>(null)
const editText = ref('')

function startEdit(m: any) {
  editingId.value = m.id
  editText.value = m.message
}

async function saveEdit() {
  if (!editText.value.trim() || !editingId.value) return
  try {
    const updated = await $fetch('/api/messages', {
      method: 'PATCH',
      body: { id: editingId.value, message: editText.value }
    })
    const idx = messages.value.findIndex(m => m.id === editingId.value)
    if (idx !== -1) messages.value[idx] = { ...messages.value[idx], message: editText.value.trim(), edited: true }
    editingId.value = null
    editText.value = ''
  } catch { /* ignore */ }
}

function cancelEdit() { editingId.value = null; editText.value = '' }

async function deleteMessage(id: number) {
  if (!confirm('Supprimer ce message ?')) return
  try {
    await $fetch(`/api/messages?id=${id}&from_id=${identity.value?.id || 0}`, { method: 'DELETE' })
    messages.value = messages.value.filter(m => m.id !== id)
  } catch { /* ignore */ }
}

function scrollBottom() {
  nextTick(() => {
    if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
  })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: string) {
  const date = new Date(d)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui"
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const groupedMessages = computed(() => {
  const groups: { date: string; messages: any[] }[] = []
  let lastDate = ''
  for (const m of messages.value) {
    const d = m.created_at?.split('T')[0]
    if (d !== lastDate) {
      groups.push({ date: d, messages: [m] })
      lastDate = d
    } else {
      groups[groups.length - 1].messages.push(m)
    }
  }
  return groups
})

function changeIdentity() {
  const { clear } = useChatIdentity()
  clear()
}

onMounted(async () => {
  loadIdentity()
  if (!identity.value) return
  await loadMessages()
  scrollBottom()
  pollTimer = setInterval(async () => {
    const lastId = messages.value.length > 0 ? messages.value[messages.value.length - 1].id : 0
    await loadMessages(lastId)
  }, 3000)
})

// Watch for identity resolution
watch(identity, async (val) => {
  if (val) {
    await loadMessages()
    scrollBottom()
    pollTimer = setInterval(async () => {
      const lastId = messages.value.length > 0 ? messages.value[messages.value.length - 1].id : 0
      await loadMessages(lastId)
    }, 3000)
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-80px)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4 flex-shrink-0">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center">
        <Icon icon="lucide:message-circle" class="w-5 h-5 text-white" />
      </div>
      <div class="flex-1">
        <h1 class="text-xl font-bold">Messages</h1>
        <p class="text-xs text-text-muted">Aksel & Amandine</p>
      </div>
      <button v-if="identity" @click="changeIdentity"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border hover:bg-surface2 transition-colors"
        :style="{ color: myColor }">
        <div class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" :style="{ background: myColor }">
          {{ myName.charAt(0) }}
        </div>
        {{ myName }}
        <Icon icon="lucide:chevron-down" class="w-3 h-3" />
      </button>
    </div>

    <!-- Chat area -->
    <div ref="chatRef" class="flex-1 overflow-y-auto space-y-6 mb-4 px-1 scroll-smooth" v-if="identity && !loading">
      <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
        <div class="text-center text-text-muted">
          <Icon icon="lucide:messages-square" class="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p class="text-sm">Pas encore de messages</p>
          <p class="text-xs mt-1">Envoyez un premier message !</p>
        </div>
      </div>

      <div v-for="group in groupedMessages" :key="group.date" class="space-y-1">
        <div class="flex justify-center mb-3">
          <span class="text-[11px] text-text-muted bg-surface px-3 py-1 rounded-full border border-border">
            {{ formatDate(group.date) }}
          </span>
        </div>

        <div v-for="m in group.messages" :key="m.id"
          class="flex gap-2.5"
          :class="m.from_id === myId ? 'justify-end' : 'justify-start'">

          <div v-if="m.from_id !== myId"
            class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 self-end"
            :style="{ background: m.from_color || '#ff6b8a' }">
            {{ m.from_name?.charAt(0) }}
          </div>

          <div class="max-w-[75%] sm:max-w-[65%]">
            <!-- Edit mode -->
            <div v-if="editingId === m.id" class="flex flex-col gap-2">
              <input v-model="editText" @keyup.enter="saveEdit" @keyup.escape="cancelEdit"
                class="w-full bg-surface2 border border-gold/50 rounded-xl px-3 py-2 text-text text-sm focus:outline-none" />
              <div class="flex gap-1 justify-end">
                <button @click="cancelEdit" class="px-2.5 py-1 rounded-lg text-xs text-text-muted hover:bg-surface2">Annuler</button>
                <button @click="saveEdit" class="px-2.5 py-1 rounded-lg text-xs bg-gold/15 text-gold font-medium hover:bg-gold/20">Enregistrer</button>
              </div>
            </div>

            <!-- Normal bubble -->
            <div v-else class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed relative group"
              :class="m.from_id === myId
                ? 'bg-gradient-to-r from-lavender to-rose text-white rounded-br-md'
                : 'bg-surface2 text-text border border-border rounded-bl-md'">
              {{ m.message }}
              <span v-if="m.edited" class="text-[10px] opacity-60 ml-1">(modifié)</span>

              <!-- Edit/delete on hover (own messages only) -->
              <div v-if="m.from_id === myId" class="absolute -top-2 right-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-0.5 -translate-y-full">
                <button @click="startEdit(m)" class="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center hover:bg-surface2 transition-colors">
                  <Icon icon="lucide:pencil" class="w-3 h-3 text-text-muted" />
                </button>
                <button @click="deleteMessage(m.id)" class="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center hover:bg-rose/10 hover:border-rose/30 transition-colors">
                  <Icon icon="lucide:trash-2" class="w-3 h-3 text-text-muted hover:text-rose" />
                </button>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-0.5"
              :class="m.from_id === myId ? 'justify-end' : 'justify-start'">
              <span class="text-[10px] text-text-muted">{{ formatTime(m.created_at) }}</span>
              <Icon v-if="m.from_id === myId && m.read" icon="lucide:check-check" class="w-3 h-3 text-lavender" />
              <Icon v-else-if="m.from_id === myId" icon="lucide:check" class="w-3 h-3 text-text-muted" />
            </div>
          </div>

          <div v-if="m.from_id === myId"
            class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 self-end"
            :style="{ background: myColor }">
            {{ myName.charAt(0) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!identity" class="flex-1 flex items-center justify-center" />

    <div v-else class="flex-1 flex items-center justify-center">
      <Icon icon="lucide:loader-circle" class="w-8 h-8 animate-spin text-text-muted" />
    </div>

    <!-- Input (blocked until identity chosen) -->
    <div class="flex gap-2 flex-shrink-0 pt-2 border-t border-border">
      <input v-if="identity" v-model="newMsg" @keyup.enter="sendMessage"
        :placeholder="`Écris un message en tant que ${myName}...`"
        class="flex-1 bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors"
        autofocus />
      <input v-else disabled placeholder="Choisis ton prénom d'abord" @click="showPicker = true"
        class="flex-1 bg-surface2 border border-border rounded-xl px-4 py-3 text-text-muted text-sm cursor-pointer" />
      <button @click="sendMessage" :disabled="!identity || !newMsg.trim()"
        class="px-4 py-3 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1.5">
        <Icon icon="lucide:send" class="w-4 h-4" />
      </button>
    </div>

    <!-- Identity picker modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPicker" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-dark/90 backdrop-blur-md" />
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-sm p-8 shadow-2xl text-center">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center mx-auto mb-4">
              <Icon icon="lucide:user" class="w-8 h-8 text-white" />
            </div>
            <h2 class="text-xl font-bold mb-1">Qui es-tu ?</h2>
            <p class="text-sm text-text-muted mb-6">Choisis ton prénom pour qu'on sache qui envoie quoi</p>

            <div class="space-y-3">
              <button @click="pick(4, 'Aksel', '#4da6ff')"
                class="w-full p-4 rounded-xl border-2 border-border hover:border-[#4da6ff] hover:bg-[#4da6ff]/5 transition-all flex items-center gap-4 group">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background: #4da6ff">A</div>
                <div class="text-left">
                  <p class="font-bold text-sm group-hover:text-[#4da6ff] transition-colors">Aksel</p>
                  <p class="text-xs text-text-muted">aksel@nousdeux.fr</p>
                </div>
              </button>

              <button @click="pick(5, 'Amandine', '#ff6b8a')"
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
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.9) translateY(20px); }
</style>
