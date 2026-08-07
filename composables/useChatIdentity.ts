// Shared chat identity — stores who's typing (Aksel or Amandine)

const STORAGE_KEY = 'nousdeux_chat_identity'

export interface ChatIdentity {
  id: number
  name: string
  color: string
}

export const useChatIdentity = () => {
  const identity = ref<ChatIdentity | null>(null)
  const showPicker = ref(false)

  function load() {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { identity.value = JSON.parse(stored) } catch { identity.value = null }
    }
    if (!identity.value) showPicker.value = true
  }

  function pick(id: number, name: string, color: string) {
    identity.value = { id, name, color }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity.value))
    showPicker.value = false
  }

  function clear() {
    identity.value = null
    showPicker.value = true
    localStorage.removeItem(STORAGE_KEY)
  }

  return { identity, showPicker, load, pick, clear }
}
