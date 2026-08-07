<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

definePageMeta({ layout: 'default' })

const account = { id: 4, name: 'Aksel', color: '#4da6ff', partner: { id: 5, name: 'Amandine', color: '#ff6b8a' } }

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
      // Append new messages
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
  if (!text) return
  try {
    const sent = await $fetch('/api/messages', { method: 'POST', body: { message: text } })
    messages.value.push(sent)
    newMsg.value = ''
    await nextTick()
    scrollBottom()
  } catch { /* garde le texte */ }
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

// Group messages by date
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

onMounted(async () => {
  await loadMessages()
  scrollBottom()
  // Poll every 3s for new messages
  pollTimer = setInterval(async () => {
    const lastId = messages.value.length > 0 ? messages.value[messages.value.length - 1].id : 0
    await loadMessages(lastId)
  }, 3000)
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
      <div>
        <h1 class="text-xl font-bold">Messages</h1>
        <p class="text-xs text-text-muted">{{ account.name }} & {{ account.partner.name }}</p>
      </div>
    </div>

    <!-- Chat area -->
    <div ref="chatRef" class="flex-1 overflow-y-auto space-y-6 mb-4 px-1 scroll-smooth" v-if="!loading">
      <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
        <div class="text-center text-text-muted">
          <Icon icon="lucide:messages-square" class="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p class="text-sm">Pas encore de messages</p>
          <p class="text-xs mt-1">Envoyez un premier message !</p>
        </div>
      </div>

      <div v-for="group in groupedMessages" :key="group.date" class="space-y-1">
        <!-- Date separator -->
        <div class="flex justify-center mb-3">
          <span class="text-[11px] text-text-muted bg-surface px-3 py-1 rounded-full border border-border">
            {{ formatDate(group.date) }}
          </span>
        </div>

        <div v-for="m in group.messages" :key="m.id"
          class="flex gap-2.5"
          :class="m.from_id === account.id ? 'justify-end' : 'justify-start'">
          <!-- Avatar (partner only) -->
          <div v-if="m.from_id !== account.id"
            class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 self-end"
            :style="{ background: m.from_color || account.partner.color }">
            {{ m.from_name?.charAt(0) }}
          </div>

          <!-- Bubble -->
          <div class="max-w-[75%] sm:max-w-[65%]"
            :class="m.from_id === account.id ? 'items-end' : 'items-start'">
            <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
              :class="m.from_id === account.id
                ? 'bg-gradient-to-r from-lavender to-rose text-white rounded-br-md'
                : 'bg-surface2 text-text border border-border rounded-bl-md'">
              {{ m.message }}
            </div>
            <div class="flex items-center gap-1.5 mt-0.5"
              :class="m.from_id === account.id ? 'justify-end' : 'justify-start'">
              <span class="text-[10px] text-text-muted">{{ formatTime(m.created_at) }}</span>
              <Icon v-if="m.from_id === account.id && m.read" icon="lucide:check-check" class="w-3 h-3 text-lavender" />
              <Icon v-else-if="m.from_id === account.id" icon="lucide:check" class="w-3 h-3 text-text-muted" />
            </div>
          </div>

          <!-- Avatar (me) -->
          <div v-if="m.from_id === account.id"
            class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 self-end"
            :style="{ background: account.color }">
            {{ account.name.charAt(0) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex-1 flex items-center justify-center">
      <Icon icon="lucide:loader-circle" class="w-8 h-8 animate-spin text-text-muted" />
    </div>

    <!-- Input -->
    <div class="flex gap-2 flex-shrink-0 pt-2 border-t border-border">
      <input v-model="newMsg" @keyup.enter="sendMessage"
        placeholder="Écris un message..."
        class="flex-1 bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors"
        autofocus />
      <button @click="sendMessage" :disabled="!newMsg.trim()"
        class="px-4 py-3 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1.5">
        <Icon icon="lucide:send" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
