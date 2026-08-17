<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

definePageMeta({ layout: 'default' })

const { fetchTodos, createTodo, updateTodo, deleteTodo, fetchUsers } = useApi()

const todos = ref<any[]>([])
const users = ref<any[]>([])
const loading = ref(true)
const activeFilter = ref<string>('all')
const showModal = ref(false)
const editingTodo = ref<any>(null)
const todoFormRef = ref<HTMLFormElement | null>(null)

function onSubmitTodo() {
  if (!todoFormRef.value) return
  const fd = new FormData(todoFormRef.value)
  handleSave({
    title: fd.get('title'),
    description: fd.get('description'),
    category_id: parseInt(fd.get('category_id') as string) || null,
    priority: fd.get('priority'),
    assigned_to: parseInt(fd.get('assigned_to') as string) || null,
    status: editingTodo.value?.status || 'todo'
  })
}

let ctx: gsap.Context | null = null

const filters = [
  { key: 'all', label: 'Toutes', icon: 'lucide:layers' },
  { key: 'À faire', label: 'À faire', icon: 'lucide:clipboard-list', color: 'gold' },
  { key: 'En cours', label: 'En cours', icon: 'lucide:zap', color: 'mint' },
  { key: 'Acquis / Fait', label: 'Fait', icon: 'lucide:check-circle', color: 'mint' },
  { key: 'Rêves', label: 'Rêves', icon: 'lucide:sparkles', color: 'lavender' },
]

const todosByCategory = computed(() => {
  const cats: Record<string, any[]> = {
    'À faire': [], 'En cours': [], 'Acquis / Fait': [], 'Rêves': [],
  }
  for (const t of todos.value) {
    const cat = t.category_name || 'À faire'
    if (cats[cat]) cats[cat].push(t)
  }
  return cats
})

const priorityConfig: Record<string, { icon: string; label: string; class: string }> = {
  dream: { icon: 'lucide:sparkles', label: 'Rêve', class: 'bg-lavender/15 text-lavender border-lavender/20' },
  high: { icon: 'lucide:flame', label: 'Haute', class: 'bg-rose/15 text-rose border-rose/20' },
  medium: { icon: 'lucide:pin', label: 'Moyenne', class: 'bg-gold/15 text-gold border-gold/20' },
  low: { icon: 'lucide:leaf', label: 'Basse', class: 'bg-mint/15 text-mint border-mint/20' },
}

const catColors: Record<string, string> = {
  'À faire': 'border-gold/40', 'En cours': 'border-mint/40', 'Acquis / Fait': 'border-mint/40', 'Rêves': 'border-lavender/40',
}

async function loadData() {
  loading.value = true
  const [t, u] = await Promise.all([fetchTodos(), fetchUsers()])
  todos.value = t || []
  users.value = u || []
  loading.value = false
  await nextTick()
  animateCards()
}

function animateCards() {
  ctx?.revert()
  ctx = gsap.context(() => {
    gsap.fromTo('.todo-card', { autoAlpha: 0, y: 20, scale: 0.96 }, {
      autoAlpha: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.04, ease: 'back.out(1.2)',
    })
    gsap.fromTo('.col-header', { autoAlpha: 0, x: -10 }, {
      autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out', delay: 0.2,
    })
  })
}

function openCreateModal() { editingTodo.value = null; showModal.value = true }
function openEditModal(todo: any) { editingTodo.value = { ...todo }; showModal.value = true }

async function handleSave(data: any) {
  if (editingTodo.value) await updateTodo(editingTodo.value.id, data)
  else await createTodo(data)
  showModal.value = false; editingTodo.value = null
  await loadData()
}

async function handleDelete(id: number) { await deleteTodo(id); await loadData() }

async function handleStatusToggle(todo: any) {
  const newStatus = todo.status === 'done' ? 'todo' : 'done'
  await updateTodo(todo.id, { status: newStatus, completed_at: newStatus === 'done' ? 'now' : null })
  await loadData()
}

onMounted(loadData)
onUnmounted(() => { ctx?.revert(); ScrollTrigger.getAll().forEach(t => t.kill()) })
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <Icon icon="lucide:list-todo" class="w-7 h-7 text-rose" />
          Tâches
        </h1>
        <p class="text-text-muted text-sm mt-1">Ce qu'on veut faire, ce qu'on a fait, et nos rêves</p>
      </div>
      <button @click="openCreateModal"
        class="px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm hover:scale-105 transition-transform duration-300 shadow-lg shadow-rose/20 flex items-center gap-2">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouvelle tâche
      </button>
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
      <p>Chargement des tâches...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="todos.length === 0" class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-rose/10 flex items-center justify-center mx-auto mb-4">
        <Icon icon="lucide:party-popper" class="w-8 h-8 text-rose" />
      </div>
      <h3 class="text-xl font-bold mb-2">Aucune tâche</h3>
      <p class="text-text-muted mb-6">Créez votre première tâche ensemble !</p>
      <button @click="openCreateModal"
        class="px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm flex items-center gap-2 mx-auto">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouvelle tâche
      </button>
    </div>

    <!-- Columns -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="(items, catName) in todosByCategory" :key="catName" class="space-y-3">
        <div class="col-header flex items-center gap-2 px-1 mb-2">
          <div class="w-1 h-4 rounded-full" :class="catColors[catName]?.replace('border', 'bg') || 'bg-gold/40'" />
          <span class="text-sm font-semibold text-text">{{ catName }}</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-surface2 text-text-muted">{{ items.length }}</span>
        </div>

        <div v-if="items.length === 0" class="bg-surface/50 border border-dashed border-border rounded-xl p-6 text-center text-text-muted text-sm">
          <Icon icon="lucide:inbox" class="w-5 h-5 mx-auto mb-1 opacity-40" /> Vide
        </div>

        <TransitionGroup name="list" tag="div" class="space-y-2">
          <div v-for="todo in items" :key="todo.id"
            class="todo-card bg-surface border border-border rounded-xl p-4 hover:border-rose/20 transition-all duration-200 cursor-pointer group"
            @click="openEditModal(todo)">
            <div class="flex items-start gap-3">
              <button @click.stop="handleStatusToggle(todo)"
                class="w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all duration-200 flex items-center justify-center"
                :class="todo.status === 'done'
                  ? 'bg-mint border-mint text-dark'
                  : 'border-border hover:border-rose group-hover:border-rose/50'">
                <Icon v-if="todo.status === 'done'" icon="lucide:check" class="w-3 h-3" />
              </button>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium transition-all duration-200" :class="{ 'line-through text-text-muted': todo.status === 'done' }">
                  {{ todo.title }}
                </p>
                <p v-if="todo.description" class="text-xs text-text-muted mt-1 line-clamp-2">{{ todo.description }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-md border flex items-center gap-1"
                    :class="priorityConfig[todo.priority]?.class || priorityConfig.medium.class">
                    <Icon :icon="priorityConfig[todo.priority]?.icon || 'lucide:pin'" class="w-3 h-3" />
                  </span>
                  <span v-if="todo.assignee_name" class="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-text-muted flex items-center gap-1">
                    <Icon icon="lucide:user" class="w-3 h-3" /> {{ todo.assignee_name }}
                  </span>
                </div>
              </div>
              <button @click.stop="handleDelete(todo.id)"
                class="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-text-muted hover:text-rose transition-all duration-200 text-xs p-1.5" aria-label="Supprimer">
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
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 class="text-lg font-bold mb-4">{{ editingTodo ? 'Modifier' : 'Nouvelle tâche' }}</h3>
            <form ref="todoFormRef" @submit.prevent="onSubmitTodo" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Titre *</label>
                <input name="title" required :value="editingTodo?.title || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Description</label>
                <textarea name="description" rows="2" :value="editingTodo?.description || ''"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors resize-none" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Catégorie</label>
                  <select name="category_id" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                    <option value="">—</option>
                    <option value="1" :selected="editingTodo?.category_id === 1">À faire</option>
                    <option value="2" :selected="editingTodo?.category_id === 2">En cours</option>
                    <option value="3" :selected="editingTodo?.category_id === 3">Acquis / Fait</option>
                    <option value="4" :selected="editingTodo?.category_id === 4">Rêves</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Priorité</label>
                  <select name="priority" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                    <option v-for="(cfg, key) in priorityConfig" :key="key" :value="key" :selected="(editingTodo?.priority || 'medium') === key">
                      {{ cfg.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Assigné à</label>
                <select name="assigned_to" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none">
                  <option value="">Les deux</option>
                  <option v-for="u in users" :key="u.id" :value="u.id" :selected="editingTodo?.assigned_to === u.id">{{ u.name }}</option>
                </select>
              </div>
              <div class="flex gap-3 pt-2">
                <button type="button" @click="showModal = false"
                  class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
                <button type="submit"
                  class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                  <Icon :icon="editingTodo ? 'lucide:save' : 'lucide:plus'" class="w-4 h-4" /> {{ editingTodo ? 'Enregistrer' : 'Créer' }}
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
.list-enter-from { opacity: 0; transform: translateY(10px); }
.list-leave-to { opacity: 0; transform: scale(0.95); }
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
</style>
