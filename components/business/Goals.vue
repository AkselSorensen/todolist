<script setup lang="ts">
import { gsap } from 'gsap'

const api = useApi()

const OWNERS = [
  { id: 4, name: 'Aksel', color: '#4da6ff' },
  { id: 5, name: 'Amandine', color: '#ff6b8a' },
  { id: null, name: 'Nous deux', color: '#f0c060' },
]
const ownerOf = (id: number | null) => OWNERS.find(o => o.id === id) || OWNERS[2]

const METRICS = [
  { key: 'net_worth', label: 'Patrimoine', icon: 'lucide:trending-up', unit: '€' },
  { key: 'savings', label: 'Épargne', icon: 'lucide:piggy-bank', unit: '€' },
  { key: 'income', label: 'Revenus', icon: 'lucide:banknote', unit: '€' },
  { key: 'custom', label: 'Libre', icon: 'lucide:target', unit: '€' },
]
const metricOf = (k: string) => METRICS.find(m => m.key === k) || METRICS[3]
const STATUSES = [
  { key: 'active', label: 'En cours', class: 'bg-gold/15 text-gold border-gold/25' },
  { key: 'reached', label: 'Atteint', class: 'bg-mint/15 text-mint border-mint/25' },
  { key: 'dropped', label: 'Abandonné', class: 'bg-surface2 text-text-muted border-border' },
]
const statusOf = (k: string) => STATUSES.find(s => s.key === k) || STATUSES[0]

const year = ref(new Date().getFullYear())
const ownerFilter = ref<'all' | number | null>('all')
const goals = ref<any[]>([])
const assets = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const pendingDelete = ref<number | null>(null)

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0)

async function load() {
  loading.value = true
  try {
    const [g, a] = await Promise.all([api.fetchBusinessGoals({ year: year.value }), api.fetchBusinessAssets()])
    goals.value = g || []
    assets.value = a || []
    errorMsg.value = ''
  } catch {
    goals.value = []
    assets.value = []
    errorMsg.value = 'Impossible de charger les objectifs.'
  }
  loading.value = false
  await nextTick()
  animate()
}

let ctx: gsap.Context | null = null
function animate() {
  ctx?.revert()
  ctx = gsap.context(() => {
    gsap.fromTo('.goal-card', { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.32, stagger: 0.05, ease: 'power3.out' })
  })
}

onMounted(load)
onUnmounted(() => ctx?.revert())
watch(year, load)

const filtered = computed(() => ownerFilter.value === 'all'
  ? goals.value
  : goals.value.filter(g => (g.owner_id ?? null) === ownerFilter.value))

// Progression : « patrimoine » se calcule depuis les actifs réels, le reste est saisi à la main
function currentFor(goal: any) {
  if (goal.metric === 'net_worth') {
    return assets.value
      .filter(a => goal.owner_id === null ? true : a.owner_id === goal.owner_id)
      .reduce((s, a) => s + (Number(a.value) || 0), 0)
  }
  return Number(goal.current_amount) || 0
}
function pct(goal: any) {
  const target = Number(goal.target_amount) || 0
  if (target <= 0) return 0
  return Math.min(100, Math.round((currentFor(goal) / target) * 100))
}
const stats = computed(() => ({
  total: filtered.value.length,
  reached: filtered.value.filter(g => g.status === 'reached' || pct(g) >= 100).length,
  active: filtered.value.filter(g => g.status === 'active' && pct(g) < 100).length,
  target: filtered.value.reduce((s, g) => s + (Number(g.target_amount) || 0), 0),
}))

/* ---------- formulaire ---------- */
const blank = () => ({
  title: '', owner_id: 4 as number | null, metric: 'net_worth', target_amount: 0,
  current_amount: 0, year: new Date().getFullYear(), due_date: '', status: 'active', notes: '',
})
const form = reactive(blank())

function openCreate() {
  Object.assign(form, blank(), { year: year.value })
  editing.value = null
  errorMsg.value = ''
  showModal.value = true
}
function openEdit(g: any) {
  Object.assign(form, blank(), {
    title: g.title || '', owner_id: g.owner_id ?? null, metric: g.metric || 'custom',
    target_amount: Number(g.target_amount) || 0, current_amount: Number(g.current_amount) || 0,
    year: g.year || year.value, due_date: g.due_date ? String(g.due_date).slice(0, 10) : '',
    status: g.status || 'active', notes: g.notes || '',
  })
  editing.value = { ...g }
  errorMsg.value = ''
  showModal.value = true
}
defineExpose({ openCreate })

async function onSubmit() {
  if (!form.title.trim() || saving.value) return
  const payload = {
    title: form.title.trim(),
    owner_id: form.owner_id === null ? null : Number(form.owner_id),
    metric: form.metric,
    target_amount: Number(form.target_amount) || 0,
    current_amount: Number(form.current_amount) || 0,
    year: Number(form.year) || new Date().getFullYear(),
    due_date: form.due_date || null,
    status: form.status,
    notes: form.notes,
  }
  saving.value = true
  try {
    if (editing.value) await api.updateBusinessGoal(editing.value.id, payload)
    else await api.createBusinessGoal(payload)
    showModal.value = false
    editing.value = null
    await load()
  } catch {
    errorMsg.value = 'Enregistrement impossible. Réessaie.'
  } finally {
    saving.value = false
  }
}

async function setStatus(goal: any, status: string) {
  try { await api.updateBusinessGoal(goal.id, { status }); await load() }
  catch { errorMsg.value = 'Mise à jour impossible.' }
}

async function removeGoal(id: number) {
  try { await api.deleteBusinessGoal(id); pendingDelete.value = null; await load() }
  catch { errorMsg.value = 'Suppression impossible.' }
}
</script>

<template>
  <div>
    <p v-if="errorMsg" class="mb-4 text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{{ errorMsg }}</p>

    <!-- Année -->
    <div class="flex items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-2">
        <button @click="year--" class="p-2 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface2 transition-colors" aria-label="Année précédente">
          <Icon icon="lucide:chevron-left" class="w-4 h-4" />
        </button>
        <span class="text-lg font-bold tabular-nums px-1">{{ year }}</span>
        <button @click="year++" class="p-2 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface2 transition-colors" aria-label="Année suivante">
          <Icon icon="lucide:chevron-right" class="w-4 h-4" />
        </button>
        <button v-if="year !== new Date().getFullYear()" @click="year = new Date().getFullYear()"
          class="ml-1 text-xs text-gold hover:text-gold-soft transition-colors">Cette année</button>
      </div>
      <span class="text-xs text-text-muted">{{ stats.total }} objectif{{ stats.total > 1 ? 's' : '' }}</span>
    </div>

    <!-- Chiffres -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-lavender/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:target" class="w-4 h-4 text-lavender" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none">{{ stats.total }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Objectifs {{ year }}</p>
        </div>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-mint/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:check-circle" class="w-4 h-4 text-mint" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none">{{ stats.reached }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Atteints</p>
        </div>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:loader" class="w-4 h-4 text-gold" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none">{{ stats.active }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">En cours</p>
        </div>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-rose/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:flag" class="w-4 h-4 text-rose" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none truncate">{{ eur(stats.target) }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Total visé</p>
        </div>
      </div>
    </div>

    <!-- Filtre par personne -->
    <div class="flex gap-2 mb-5 overflow-x-auto pb-2">
      <button @click="ownerFilter = 'all'"
        class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2"
        :class="ownerFilter === 'all' ? 'bg-rose/15 text-rose border border-rose/30' : 'bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted/30'">
        <Icon icon="lucide:users" class="w-4 h-4" /> Les deux
      </button>
      <button v-for="o in OWNERS" :key="String(o.id)" @click="ownerFilter = o.id as any"
        class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2"
        :class="ownerFilter === o.id ? 'bg-rose/15 text-rose border border-rose/30' : 'bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted/30'">
        <span class="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold text-white" :style="{ background: o.color }">{{ o.name.charAt(0) }}</span>
        {{ o.name }}
      </button>
    </div>

    <div v-if="loading" class="text-center py-16 text-text-muted">
      <Icon icon="lucide:loader-circle" class="w-10 h-10 mx-auto animate-spin mb-4" />
      <p>Chargement des objectifs...</p>
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-lavender/10 flex items-center justify-center mx-auto mb-4">
        <Icon icon="lucide:target" class="w-8 h-8 text-lavender" />
      </div>
      <h3 class="text-xl font-bold mb-2">Aucun objectif pour {{ year }}</h3>
      <p class="text-text-muted mb-6">Fixez-vous une cible : patrimoine, épargne, revenus — et suivez-la.</p>
      <button @click="openCreate"
        class="px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm flex items-center gap-2 mx-auto">
        <Icon icon="lucide:plus" class="w-4 h-4" /> Nouvel objectif
      </button>
    </div>

    <div v-else class="space-y-3">
      <div v-for="g in filtered" :key="g.id"
        class="goal-card bg-surface border border-border rounded-xl p-4 hover:border-rose/20 transition-all duration-200"
        :class="{ 'opacity-60': g.status === 'dropped' }">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center flex-shrink-0">
            <Icon :icon="metricOf(g.metric).icon" class="w-4 h-4 text-text-muted" />
          </div>

          <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(g)">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-medium" :class="{ 'line-through text-text-muted': g.status === 'dropped' }">{{ g.title }}</p>
              <span class="text-[10px] px-1.5 py-0.5 rounded-md border" :class="statusOf(g.status).class">{{ statusOf(g.status).label }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-text-muted flex items-center gap-1">
                <Icon :icon="metricOf(g.metric).icon" class="w-3 h-3" /> {{ metricOf(g.metric).label }}
              </span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-md border border-border text-text-muted flex items-center gap-1">
                <span class="w-3 h-3 rounded-sm flex items-center justify-center text-[7px] font-bold text-white" :style="{ background: ownerOf(g.owner_id).color }">{{ ownerOf(g.owner_id).name.charAt(0) }}</span>
                {{ ownerOf(g.owner_id).name }}
              </span>
            </div>

            <div class="flex items-center gap-3 mt-3">
              <div class="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                  :class="pct(g) >= 100 ? 'bg-mint' : 'bg-gradient-to-r from-rose to-lavender'"
                  :style="{ width: pct(g) + '%' }" />
              </div>
              <span class="text-xs font-semibold tabular-nums flex-shrink-0" :class="pct(g) >= 100 ? 'text-mint' : 'text-text'">{{ pct(g) }} %</span>
            </div>

            <p class="text-xs text-text-muted mt-2 flex items-center gap-2 flex-wrap">
              <span><b class="text-text">{{ eur(currentFor(g)) }}</b> sur {{ eur(g.target_amount) }}</span>
              <span v-if="g.metric === 'net_worth'" class="flex items-center gap-1 text-lavender">
                <Icon icon="lucide:info" class="w-3 h-3" /> calculé depuis les actifs
              </span>
              <span v-if="Number(g.target_amount) > currentFor(g)" class="flex items-center gap-1">
                <Icon icon="lucide:trending-up" class="w-3 h-3" /> reste {{ eur(Number(g.target_amount) - currentFor(g)) }}
              </span>
              <span v-if="g.due_date" class="flex items-center gap-1">
                <Icon icon="lucide:calendar" class="w-3 h-3" /> {{ new Date(g.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }}
              </span>
            </p>
            <p v-if="g.notes" class="text-xs text-text-muted/80 mt-1 line-clamp-1">{{ g.notes }}</p>
          </div>

          <div class="flex items-center gap-0.5 flex-shrink-0">
            <button v-if="g.status === 'active' && pct(g) < 100" @click.stop="setStatus(g, 'reached')"
              class="p-1.5 text-text-muted hover:text-mint transition-colors" aria-label="Marquer atteint">
              <Icon icon="lucide:check" class="w-3.5 h-3.5" />
            </button>
            <button @click.stop="pendingDelete = g.id"
              class="p-1.5 text-text-muted hover:text-rose transition-colors" aria-label="Supprimer">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div v-if="pendingDelete === g.id" class="mt-3 flex items-center gap-2 bg-rose/5 border border-rose/20 rounded-xl px-3 py-2">
          <p class="text-xs flex-1">Supprimer « {{ g.title }} » ?</p>
          <button @click.stop="pendingDelete = null" class="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:bg-surface2 transition-colors">Annuler</button>
          <button @click.stop="removeGoal(g.id)" class="px-3 py-1 rounded-lg bg-rose text-white text-xs font-semibold hover:bg-rose-soft transition-colors">Supprimer</button>
        </div>
      </div>
    </div>

    <!-- Modale objectif -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
          <div class="relative w-full sm:max-w-lg bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe-lg">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon icon="lucide:target" class="w-5 h-5 text-lavender" />
              {{ editing ? "Modifier l'objectif" : 'Nouvel objectif' }}
            </h3>

            <form @submit.prevent="onSubmit" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Objectif *</label>
                <input v-model="form.title" required placeholder="Atteindre 25 000 € de patrimoine"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">À qui</label>
                <div class="flex gap-2">
                  <button v-for="o in OWNERS" :key="String(o.id)" type="button" @click="form.owner_id = o.id"
                    class="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center justify-center gap-2"
                    :class="form.owner_id === o.id ? 'bg-surface2 border-gold/40 text-text' : 'bg-surface2/50 border-border text-text-muted hover:text-text'">
                    <span class="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold text-white" :style="{ background: o.color }">{{ o.name.charAt(0) }}</span>
                    {{ o.name }}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Type</label>
                  <select v-model="form.metric" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                    <option v-for="m in METRICS" :key="m.key" :value="m.key">{{ m.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Année</label>
                  <input v-model="form.year" type="number" min="2000" max="2100" step="1"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Cible (€)</label>
                  <input v-model="form.target_amount" type="number" min="0" step="100"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">
                    Déjà atteint (€)
                    <span v-if="form.metric === 'net_worth'" class="text-lavender">(auto)</span>
                  </label>
                  <input v-model="form.current_amount" type="number" min="0" step="100" :disabled="form.metric === 'net_worth'"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 disabled:opacity-50" />
                </div>
              </div>
              <p v-if="form.metric === 'net_worth'" class="text-[11px] text-lavender flex items-center gap-1.5">
                <Icon icon="lucide:info" class="w-3.5 h-3.5" /> La progression se calcule automatiquement depuis les actifs de la personne.
              </p>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Échéance <span class="text-text-muted/70">(optionnel)</span></label>
                  <input v-model="form.due_date" type="date"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">État</label>
                  <select v-model="form.status" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                    <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Notes</label>
                <textarea v-model="form.notes" rows="2" placeholder="Comment on s'y tient..."
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
