<script setup lang="ts">
import { gsap } from 'gsap'

const api = useApi()
const account = { id: 4, name: 'Aksel', partner: { id: 5, name: 'Amandine' } }

const ideas = ref<any[]>([])
const loading = ref(true)
const activeStage = ref('all')
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const errorMsg = ref('')
const openId = ref<number | null>(null)
const pendingDelete = ref<number | null>(null)
const draft: Record<number, string> = reactive({})

const STAGES = [
  { key: 'idea', label: 'Idée', icon: 'lucide:lightbulb', class: 'bg-gold/15 text-gold border-gold/25', dot: 'bg-gold' },
  { key: 'studying', label: "À l'étude", icon: 'lucide:search', class: 'bg-lavender/15 text-lavender border-lavender/25', dot: 'bg-lavender' },
  { key: 'building', label: 'En construction', icon: 'lucide:hammer', class: 'bg-rose/15 text-rose border-rose/25', dot: 'bg-rose' },
  { key: 'launched', label: 'Lancée', icon: 'lucide:rocket', class: 'bg-mint/15 text-mint border-mint/25', dot: 'bg-mint' },
  { key: 'dropped', label: 'Abandonnée', icon: 'lucide:archive', class: 'bg-surface2 text-text-muted border-border', dot: 'bg-text-muted' },
]
const EFFORTS = [
  { key: 'low', label: 'Charge faible', icon: 'lucide:leaf' },
  { key: 'medium', label: 'Charge moyenne', icon: 'lucide:gauge' },
  { key: 'high', label: 'Charge élevée', icon: 'lucide:flame' },
]
const stageOf = (k: string) => STAGES.find(s => s.key === k) || STAGES[0]
const effortOf = (k: string) => EFFORTS.find(s => s.key === k) || EFFORTS[1]

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0)

const filtered = computed(() =>
  activeStage.value === 'all' ? ideas.value : ideas.value.filter(i => i.stage === activeStage.value))

const totals = computed(() => {
  const live = ideas.value.filter(i => i.stage !== 'dropped')
  const sum = (k: string) => live.reduce((a, i) => a + (Number(i[k]) || 0), 0)
  return { count: live.length, invested: sum('invested'), monthly: sum('monthly_target'), earned: sum('earned') }
})

// « combien d'argent » : dans combien de mois l'idée rembourse ce qu'elle a coûté
function payback(idea: any) {
  const rest = (Number(idea.invested) || 0) - (Number(idea.earned) || 0)
  const monthly = Number(idea.monthly_target) || 0
  if (rest <= 0 || monthly <= 0) return null
  return Math.ceil(rest / monthly)
}

const taskStats = (idea: any) => {
  const t = idea.tasks || []
  return { done: t.filter((x: any) => x.done).length, total: t.length }
}

/* ---------- data ---------- */
async function load() {
  try {
    ideas.value = (await api.fetchBusinessIdeas()) || []
    errorMsg.value = ''
  } catch {
    ideas.value = []
    errorMsg.value = 'Impossible de charger les idées.'
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

onMounted(load)
onUnmounted(() => ctx?.revert())

/* ---------- formulaire ---------- */
const blank = () => ({
  title: '', pitch: '', stage: 'idea', effort: 'medium',
  invested: 0, monthly_target: 0, earned: 0, next_step: '', link: '',
})
const form = reactive(blank())

function openCreate() {
  Object.assign(form, blank())
  editing.value = null
  errorMsg.value = ''
  showModal.value = true
}
function openEdit(idea: any) {
  Object.assign(form, blank(), {
    title: idea.title || '', pitch: idea.pitch || '', stage: idea.stage || 'idea',
    effort: idea.effort || 'medium', invested: Number(idea.invested) || 0,
    monthly_target: Number(idea.monthly_target) || 0, earned: Number(idea.earned) || 0,
    next_step: idea.next_step || '', link: idea.link || '',
  })
  editing.value = { ...idea }
  errorMsg.value = ''
  showModal.value = true
}
defineExpose({ openCreate })

async function onSubmit() {
  if (!form.title.trim() || saving.value) return
  const payload = {
    title: form.title.trim(), pitch: form.pitch, stage: form.stage, effort: form.effort,
    invested: Number(form.invested) || 0, monthly_target: Number(form.monthly_target) || 0,
    earned: Number(form.earned) || 0, next_step: form.next_step, link: form.link,
  }
  saving.value = true
  try {
    if (editing.value) await api.updateBusinessIdea(editing.value.id, payload)
    else await api.createBusinessIdea(payload)
    showModal.value = false
    editing.value = null
    await load()
  } catch {
    errorMsg.value = "Enregistrement impossible. Réessaie."
  } finally {
    saving.value = false
  }
}

async function removeIdea(id: number) {
  try {
    await api.deleteBusinessIdea(id)
    pendingDelete.value = null
    await load()
  } catch { errorMsg.value = 'Suppression impossible.' }
}

async function setStage(idea: any, stage: string) {
  try {
    await api.updateBusinessIdea(idea.id, { stage })
    await load()
  } catch { errorMsg.value = 'Mise à jour impossible.' }
}

/* ---------- checklist ---------- */
async function addTask(idea: any) {
  const label = (draft[idea.id] || '').trim()
  if (!label) return
  draft[idea.id] = ''
  try {
    await api.createBusinessIdeaTask(idea.id, { label })
    await load()
    openId.value = idea.id
  } catch { errorMsg.value = "Ajout impossible." }
}

async function toggleTask(idea: any, task: any) {
  task.done = !task.done  // optimiste
  try {
    await api.updateBusinessIdeaTask(idea.id, task.id, { done: task.done })
  } catch {
    task.done = !task.done
    errorMsg.value = 'Mise à jour impossible.'
  }
}

async function removeTask(idea: any, task: any) {
  try {
    await api.deleteBusinessIdeaTask(idea.id, task.id)
    await load()
    openId.value = idea.id
  } catch { errorMsg.value = 'Suppression impossible.' }
}
</script>

<template>
  <div>
    <p v-if="errorMsg" class="mb-4 text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{{ errorMsg }}</p>

    <!-- Combien d'argent -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div class="stat-card bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-lavender/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:lightbulb" class="w-4 h-4 text-lavender" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none">{{ totals.count }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Idées suivies</p>
        </div>
      </div>
      <div class="stat-card bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:piggy-bank" class="w-4 h-4 text-gold" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none truncate">{{ eur(totals.invested) }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Investi</p>
        </div>
      </div>
      <div class="stat-card bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-mint/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:trending-up" class="w-4 h-4 text-mint" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none truncate">{{ eur(totals.monthly) }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Potentiel / mois</p>
        </div>
      </div>
      <div class="stat-card bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-rose/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:circle-dollar-sign" class="w-4 h-4 text-rose" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none truncate">{{ eur(totals.earned) }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Déjà gagné</p>
        </div>
      </div>
    </div>

    <!-- Filtres par étape -->
    <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
      <button @click="activeStage = 'all'"
        class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2"
        :class="activeStage === 'all' ? 'bg-rose/15 text-rose border border-rose/30' : 'bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted/30'">
        <Icon icon="lucide:layers" class="w-4 h-4" /> Toutes
      </button>
      <button v-for="s in STAGES" :key="s.key" @click="activeStage = s.key"
        class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2"
        :class="activeStage === s.key ? 'bg-rose/15 text-rose border border-rose/30' : 'bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted/30'">
        <Icon :icon="s.icon" class="w-4 h-4" /> {{ s.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16 text-text-muted">
      <Icon icon="lucide:loader-circle" class="w-10 h-10 mx-auto animate-spin mb-4" />
      <p>Chargement des idées...</p>
    </div>

    <!-- Vide -->
    <div v-else-if="filtered.length === 0" class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-lavender/10 flex items-center justify-center mx-auto mb-4">
        <Icon icon="lucide:lightbulb" class="w-8 h-8 text-lavender" />
      </div>
      <h3 class="text-xl font-bold mb-2">Aucune idée</h3>
      <p class="text-text-muted mb-6">
        {{ activeStage === 'all' ? 'Note ta première idée : quoi faire, et combien ça peut rapporter.' : 'Rien sur ce filtre — essaie « Toutes ».' }}
      </p>
      <button @click="openCreate"
        class="px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm flex items-center gap-2 mx-auto">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouvelle idée
      </button>
    </div>

    <!-- Idées -->
    <div v-else class="space-y-3">
      <div v-for="it in filtered" :key="it.id"
        class="biz-card bg-surface border border-border rounded-xl p-4 hover:border-rose/20 transition-all duration-200"
        :class="{ 'opacity-60': it.stage === 'dropped' }">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center flex-shrink-0">
            <Icon :icon="stageOf(it.stage).icon" class="w-4 h-4" :class="stageOf(it.stage).class.split(' ')[1]" />
          </div>

          <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(it)">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-medium" :class="{ 'line-through text-text-muted': it.stage === 'dropped' }">{{ it.title }}</p>
              <span class="text-[10px] px-1.5 py-0.5 rounded-md border" :class="stageOf(it.stage).class">{{ stageOf(it.stage).label }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-text-muted flex items-center gap-1">
                <Icon :icon="effortOf(it.effort).icon" class="w-3 h-3" /> {{ effortOf(it.effort).label }}
              </span>
            </div>

            <p v-if="it.pitch" class="text-xs text-text-muted mt-1.5 line-clamp-2">{{ it.pitch }}</p>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px]">
              <span class="flex items-center gap-1.5 text-text-muted">
                <Icon icon="lucide:piggy-bank" class="w-3.5 h-3.5" /> Investi
                <b class="text-text">{{ eur(it.invested) }}</b>
              </span>
              <span class="flex items-center gap-1.5 text-mint">
                <Icon icon="lucide:trending-up" class="w-3.5 h-3.5" /> <b>{{ eur(it.monthly_target) }}</b> / mois
              </span>
              <span class="flex items-center gap-1.5 text-gold">
                <Icon icon="lucide:circle-dollar-sign" class="w-3.5 h-3.5" /> Gagné <b>{{ eur(it.earned) }}</b>
              </span>
              <span v-if="payback(it)" class="flex items-center gap-1.5 text-lavender">
                <Icon icon="lucide:calculator" class="w-3.5 h-3.5" /> Rentable dans ~{{ payback(it) }} mois
              </span>
            </div>

            <p v-if="it.next_step" class="text-xs mt-2.5 flex items-start gap-1.5">
              <Icon icon="lucide:circle-arrow-right" class="w-3.5 h-3.5 mt-px text-lavender flex-shrink-0" />
              <span class="text-text">{{ it.next_step }}</span>
            </p>
            <p v-if="it.owner_name" class="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
              <Icon icon="lucide:user" class="w-3 h-3" /> <span :style="{ color: it.owner_color || undefined }">{{ it.owner_name }}</span>
            </p>
          </div>

          <div class="flex items-center gap-0.5 flex-shrink-0">
            <a v-if="it.link" :href="it.link" target="_blank" rel="noopener"
              class="p-1.5 text-text-muted hover:text-mint transition-colors" aria-label="Ouvrir le lien" @click.stop>
              <Icon icon="lucide:external-link" class="w-3.5 h-3.5" />
            </a>
            <button v-if="it.stage !== 'launched'" @click.stop="setStage(it, 'launched')"
              class="p-1.5 text-text-muted hover:text-mint transition-colors" aria-label="Marquer lancée">
              <Icon icon="lucide:rocket" class="w-3.5 h-3.5" />
            </button>
            <button @click.stop="pendingDelete = it.id"
              class="p-1.5 text-text-muted hover:text-rose transition-colors" aria-label="Supprimer">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Quoi faire : progression + checklist -->
        <button @click="openId = openId === it.id ? null : it.id"
          class="mt-3 w-full flex items-center gap-3 text-left group">
          <div class="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-rose to-lavender rounded-full transition-all duration-300"
              :style="{ width: (taskStats(it).total ? (taskStats(it).done / taskStats(it).total) * 100 : 0) + '%' }" />
          </div>
          <span class="text-[11px] text-text-muted flex items-center gap-1.5 flex-shrink-0">
            <Icon icon="lucide:list-checks" class="w-3.5 h-3.5" />
            {{ taskStats(it).done }}/{{ taskStats(it).total }} à faire
            <Icon :icon="openId === it.id ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="w-3.5 h-3.5" />
          </span>
        </button>

        <div v-if="openId === it.id" class="mt-3 bg-surface2/60 border border-border rounded-xl p-3 space-y-1.5">
          <p v-if="!it.tasks.length" class="text-xs text-text-muted px-1 py-1">Rien à faire pour l'instant — ajoute la première étape.</p>
          <div v-for="t in it.tasks" :key="t.id" class="flex items-center gap-2.5 group/task">
            <button @click="toggleTask(it, t)"
              class="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all duration-200 flex items-center justify-center"
              :class="t.done ? 'bg-mint border-mint text-dark' : 'border-border hover:border-rose'">
              <Icon v-if="t.done" icon="lucide:check" class="w-2.5 h-2.5" />
            </button>
            <span class="text-xs flex-1 min-w-0" :class="{ 'line-through text-text-muted': t.done }">{{ t.label }}</span>
            <button @click="removeTask(it, t)"
              class="p-1 text-text-muted hover:text-rose transition-colors opacity-60 sm:opacity-0 sm:group-hover/task:opacity-100"
              aria-label="Supprimer l'étape">
              <Icon icon="lucide:x" class="w-3 h-3" />
            </button>
          </div>

          <div class="flex gap-2 pt-1.5">
            <input v-model="draft[it.id]" placeholder="Ajouter une étape..."
              class="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-rose/50 transition-colors"
              @keydown.enter.prevent="addTask(it)" />
            <button @click="addTask(it)" aria-label="Ajouter l'étape"
              class="px-3 py-2 rounded-lg bg-rose/15 text-rose border border-rose/25 hover:bg-rose/25 transition-colors flex items-center justify-center">
              <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Confirmation de suppression -->
        <div v-if="pendingDelete === it.id" class="mt-3 flex items-center gap-2 bg-rose/5 border border-rose/20 rounded-xl px-3 py-2">
          <p class="text-xs flex-1">Supprimer « {{ it.title }} » et ses étapes ?</p>
          <button @click.stop="pendingDelete = null" class="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:bg-surface2 transition-colors">Annuler</button>
          <button @click.stop="removeIdea(it.id)" class="px-3 py-1 rounded-lg bg-rose text-white text-xs font-semibold hover:bg-rose-soft transition-colors">Supprimer</button>
        </div>
      </div>
    </div>

    <!-- Modale idée -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
          <div class="relative w-full sm:max-w-lg bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe-lg">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon icon="lucide:lightbulb" class="w-5 h-5 text-lavender" />
              {{ editing ? "Modifier l'idée" : 'Nouvelle idée' }}
            </h3>

            <form @submit.prevent="onSubmit" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Idée *</label>
                <input v-model="form.title" required placeholder="App de réservation pour hôtels indépendants"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">En deux mots</label>
                <textarea v-model="form.pitch" rows="2" placeholder="Le problème, pour qui, pourquoi ça marche"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors resize-none" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Où on en est</label>
                  <select v-model="form.stage" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                    <option v-for="s in STAGES" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Charge</label>
                  <select v-model="form.effort" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                    <option v-for="s in EFFORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                </div>
              </div>

              <div class="bg-surface2 rounded-xl p-3 space-y-3">
                <p class="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                  <Icon icon="lucide:circle-dollar-sign" class="w-3.5 h-3.5" /> Combien d'argent
                </p>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[11px] text-text-muted mb-1">Investi (€)</label>
                    <input v-model="form.invested" type="number" min="0" step="10"
                      class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-rose/50" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-text-muted mb-1">Potentiel / mois</label>
                    <input v-model="form.monthly_target" type="number" min="0" step="10"
                      class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-rose/50" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-text-muted mb-1">Déjà gagné (€)</label>
                    <input v-model="form.earned" type="number" min="0" step="10"
                      class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-rose/50" />
                  </div>
                </div>
                <p v-if="payback({ invested: form.invested, earned: form.earned, monthly_target: form.monthly_target })"
                  class="text-[11px] text-lavender flex items-center gap-1.5">
                  <Icon icon="lucide:calculator" class="w-3.5 h-3.5" />
                  Rentabilisée en ~{{ payback({ invested: form.invested, earned: form.earned, monthly_target: form.monthly_target }) }} mois à ce rythme
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Prochaine action</label>
                <input v-model="form.next_step" placeholder="Appeler 3 hôtels pour valider le besoin"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Lien</label>
                <input v-model="form.link" type="url" placeholder="https://notion.so/..."
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
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
