<script setup lang="ts">
import { gsap } from 'gsap'

// Gestion des dépenses : saisie du mois + bilan (score, graphiques, conseils).
const api = useApi()

/* ------------------------------------------------------------- présentation */

// Catalogue partagé avec l'onglet Bilan : un poste = une catégorie, chaque catégorie
// appartient à un bucket (la classe de calcul utilisée par les agrégats).
import { EXPENSE_CATS as CATS, EXPENSE_BUCKETS as BUCKETS } from '~/utils/expenseCatalog'

const OWNERS = [
  { id: 4, name: 'Aksel', color: '#4da6ff' },
  { id: 5, name: 'Amandine', color: '#ff6b8a' },
  { id: null as any, name: 'Nous deux', color: '#f0c060' },
]

const PAYMENTS = [
  { key: 'cb', label: 'Carte' },
  { key: 'virement', label: 'Virement' },
  { key: 'prelevement', label: 'Prélèvement' },
  { key: 'especes', label: 'Espèces' },
  { key: 'cheque', label: 'Chèque' },
]

const catOf = (k: string) => CATS.find(c => c.key === k) || CATS[CATS.length - 1]
const bucketOf = (k: string) => BUCKETS.find(b => b.key === k) || BUCKETS[2]
const ownerOf = (id: any) => OWNERS.find(o => o.id === (id ?? null)) || OWNERS[2]

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0)
const eur2 = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
const monthLabel = (m: string) => {
  const [y, mo] = String(m).split('-').map(Number)
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}
const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const nowMonth = () => new Date().toISOString().slice(0, 7)

/* ------------------------------------------------------------------- état */

const view = ref<'suivi' | 'bilan'>('suivi')
const month = ref(nowMonth())
const ownerFilter = ref<'all' | number | 'common'>('all')
const bucketFilter = ref<'all' | string>('all')

const rows = ref<any[]>([])
const months = ref<string[]>([nowMonth()])
const summary = ref<any>({ income: 0, expense: 0, saved: 0, balance: 0, count: 0, fixed: 0, variable: 0, travel: 0 })
const loading = ref(true)
const busy = ref(false)
const errorMsg = ref('')

const reportRef = ref<any>(null)

async function load() {
  loading.value = true
  try {
    const r = await api.fetchExpenses({
      month: month.value,
      owner: ownerFilter.value === 'all' ? undefined : ownerFilter.value,
      bucket: bucketFilter.value === 'all' ? undefined : bucketFilter.value,
    })
    rows.value = r?.rows || []
    summary.value = r?.summary || summary.value
    months.value = r?.months?.length ? r.months : [nowMonth()]
    errorMsg.value = ''
  } catch (err: any) {
    rows.value = []
    errorMsg.value = 'Impossible de charger les dépenses' + (err?.data?.message ? ` (${err.data.message})` : '.')
  }
  loading.value = false
  await nextTick()
  animate()
}

let ctx: gsap.Context | null = null
function animate() {
  ctx?.revert()
  ctx = gsap.context(() => {
    gsap.fromTo('.exp-row', { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.025, ease: 'power3.out' })
    gsap.fromTo('.exp-kpi', { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power3.out' })
  })
}

onMounted(load)
onUnmounted(() => ctx?.revert())

watch([ownerFilter, bucketFilter], () => { if (view.value === 'suivi') load() })

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  load()
}

const isCurrentMonth = computed(() => month.value === nowMonth())
const savingsRate = computed(() => {
  const s = summary.value
  return s.income > 0 ? (s.saved / s.income) * 100 : null
})

/* -------------------------------------------------------------- regroupement */

const groups = computed(() => {
  const map = new Map<string, { category: string; bucket: string; items: any[]; total: number }>()
  for (const r of rows.value) {
    const g = map.get(r.category) || { category: r.category, bucket: r.bucket, items: [], total: 0 }
    g.items.push(r)
    g.total += Number(r.amount) || 0
    map.set(r.category, g)
  }
  const order = BUCKETS.map(b => b.key)
  return [...map.values()].sort((a, b) => {
    const d = order.indexOf(a.bucket as any) - order.indexOf(b.bucket as any)
    return d !== 0 ? d : b.total - a.total
  })
})

/* ----------------------------------------------------------------- formulaire */

const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const pendingDelete = ref<number | null>(null)

const blank = () => ({
  label: '',
  category: 'courses',
  amount: '' as any,
  spent_on: new Date().toISOString().slice(0, 10),
  owner_id: 4 as any,
  payment: 'cb',
  recurring: false,
  recur_day: new Date().getDate(),
  notes: '',
})
const form = reactive(blank())

function openCreate(preset?: { category?: string; owner_id?: any }) {
  Object.assign(form, blank())
  if (preset?.category) form.category = preset.category
  if (preset && 'owner_id' in preset) form.owner_id = preset.owner_id
  editing.value = null
  errorMsg.value = ''
  showModal.value = true
}
function openEdit(r: any) {
  Object.assign(form, blank(), {
    label: r.label || '',
    category: r.category || 'autre',
    amount: Number(r.amount) || 0,
    spent_on: String(r.spent_on).slice(0, 10),
    owner_id: r.owner_id ?? null,
    payment: r.payment || 'cb',
    recurring: !!r.recurring,
    recur_day: r.recur_day || new Date(String(r.spent_on).slice(0, 10) + 'T12:00:00').getDate(),
    notes: r.notes || '',
  })
  editing.value = { ...r }
  errorMsg.value = ''
  showModal.value = true
}
defineExpose({ openCreate })

const formBucket = computed(() => bucketOf(catOf(form.category).bucket))

const grouped = computed(() => BUCKETS.map(b => ({
  ...b,
  cats: CATS.filter(c => c.bucket === b.key),
})))

async function onSubmit() {
  if (!form.label.trim() || saving.value) return
  const payload = {
    label: form.label.trim(),
    category: form.category,
    amount: Number(form.amount) || 0,
    spent_on: form.spent_on,
    owner_id: form.owner_id === null ? null : Number(form.owner_id),
    payment: form.payment,
    recurring: !!form.recurring,
    recur_day: form.recurring ? Number(form.recur_day) || 1 : null,
    notes: form.notes,
  }
  saving.value = true
  const isNew = !editing.value
  try {
    if (editing.value) await api.updateExpense(editing.value.id, payload)
    else await api.createExpense(payload)
    showModal.value = false
    editing.value = null
    // une nouvelle saisie peut atterrir sur un autre mois : on suit la date choisie
    const target = String(payload.spent_on).slice(0, 7)
    if (isNew && target !== month.value) month.value = target
    await load()
  } catch (err: any) {
    errorMsg.value = "Enregistrement impossible : " + (err?.data?.message || 'réessaie.')
  } finally {
    saving.value = false
  }
}

async function removeExpense(id: number) {
  try {
    await api.deleteExpense(id)
    pendingDelete.value = null
    await load()
  } catch { errorMsg.value = 'Suppression impossible.' }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Bascule Suivi / Bilan -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="bg-surface border border-border rounded-xl p-1 flex gap-1">
        <button @click="view = 'suivi'"
          class="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
          :class="view === 'suivi' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text'">
          <Icon icon="lucide:list" class="w-4 h-4" /> Suivi
        </button>
        <button @click="view = 'bilan'"
          class="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
          :class="view === 'bilan' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text'">
          <Icon icon="lucide:chart-pie" class="w-4 h-4" /> Bilan &amp; conseils
        </button>
      </div>

      <div v-if="view === 'suivi'" class="flex items-center gap-2">
        <button @click="shiftMonth(-1)" class="p-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text transition-colors" aria-label="Mois précédent">
          <Icon icon="lucide:chevron-left" class="w-4 h-4" />
        </button>
        <select v-model="month" @change="load"
          class="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-rose/50 min-w-[9.5rem]">
          <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
        </select>
        <button @click="shiftMonth(1)" :disabled="isCurrentMonth"
          class="p-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text transition-colors disabled:opacity-40" aria-label="Mois suivant">
          <Icon icon="lucide:chevron-right" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{{ errorMsg }}</p>

    <!-- ------------------------------------------------------------ SUIVI -->
    <template v-if="view === 'suivi'">
      <!-- Chiffres du mois -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="exp-kpi bg-surface border border-border rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Icon icon="lucide:arrow-down-left" class="w-4 h-4 text-mint" />
            <span class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Revenus</span>
          </div>
          <p class="text-xl font-bold leading-none text-mint">{{ eur(summary.income) }}</p>
        </div>
        <div class="exp-kpi bg-surface border border-border rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Icon icon="lucide:receipt" class="w-4 h-4 text-rose" />
            <span class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Dépenses</span>
          </div>
          <p class="text-xl font-bold leading-none">{{ eur(summary.expense) }}</p>
          <p class="text-[11px] text-text-muted mt-1">
            {{ eur(summary.fixed) }} fixes · {{ eur(summary.variable) }} var.<span v-if="summary.travel > 0"> · {{ eur(summary.travel) }} voyage</span>
          </p>
        </div>
        <div class="exp-kpi bg-surface border border-border rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Icon icon="lucide:piggy-bank" class="w-4 h-4 text-gold" />
            <span class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Mis de côté</span>
          </div>
          <p class="text-xl font-bold leading-none text-gold">{{ eur(summary.saved) }}</p>
          <p class="text-[11px] text-text-muted mt-1">
            {{ eur(summary.savings) }} épargne · {{ eur(summary.investment) }} invest.
          </p>
        </div>
        <div class="exp-kpi bg-surface border border-border rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Icon :icon="summary.balance >= 0 ? 'lucide:check-circle' : 'lucide:triangle-alert'" class="w-4 h-4"
              :class="summary.balance >= 0 ? 'text-mint' : 'text-rose'" />
            <span class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Reste</span>
          </div>
          <p class="text-xl font-bold leading-none" :class="summary.balance >= 0 ? 'text-text' : 'text-rose'">{{ eur(summary.balance) }}</p>
          <p class="text-[11px] text-text-muted mt-1">
            <span v-if="savingsRate !== null">{{ Math.round(savingsRate) }} % d'épargne</span>
            <span v-else>{{ summary.count }} ligne{{ summary.count > 1 ? 's' : '' }}</span>
          </p>
        </div>
      </div>

      <!-- Filtres -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button @click="ownerFilter = 'all'"
          class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors"
          :class="ownerFilter === 'all' ? 'bg-surface2 border-rose/40 text-text' : 'bg-surface/60 border-border text-text-muted hover:text-text'">
          Tout
        </button>
        <button v-for="o in OWNERS" :key="String(o.id)" @click="ownerFilter = o.id === null ? 'common' : o.id"
          class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1.5"
          :class="(ownerFilter === o.id || (o.id === null && ownerFilter === 'common')) ? 'bg-surface2 border-rose/40 text-text' : 'bg-surface/60 border-border text-text-muted hover:text-text'">
          <span class="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold text-white" :style="{ background: o.color }">{{ o.name.charAt(0) }}</span>
          {{ o.name }}
        </button>
        <span class="w-px h-5 bg-border mx-1 hidden sm:block" />
        <button @click="bucketFilter = 'all'"
          class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors"
          :class="bucketFilter === 'all' ? 'bg-surface2 border-rose/40 text-text' : 'bg-surface/60 border-border text-text-muted hover:text-text'">
          Tous types
        </button>
        <button v-for="b in BUCKETS" :key="b.key" @click="bucketFilter = b.key"
          class="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1.5"
          :class="bucketFilter === b.key ? 'bg-surface2 border-rose/40 text-text' : 'bg-surface/60 border-border text-text-muted hover:text-text'">
          <Icon :icon="b.icon" class="w-3 h-3" :style="{ color: b.color }" /> {{ b.short }}
        </button>
      </div>

      <!-- Liste -->
      <div v-if="loading" class="text-center py-10 text-text-muted text-sm">
        <Icon icon="lucide:loader-circle" class="w-7 h-7 mx-auto animate-spin mb-2" /> Chargement...
      </div>

      <div v-else-if="rows.length === 0" class="bg-surface/50 border border-dashed border-border rounded-xl p-8 text-center">
        <Icon icon="lucide:receipt" class="w-7 h-7 mx-auto mb-2 text-text-muted opacity-50" />
        <p class="text-sm text-text-muted mb-1">Aucune ligne sur {{ monthLabel(month) }}</p>
        <p class="text-xs text-text-muted/80 mb-4 max-w-md mx-auto">
          Commence par les charges fixes (loyer, charges, abonnements) et les revenus en cochant
          « chaque mois » : elles sont ensuite recréées automatiquement.
        </p>
        <button @click="openCreate({ category: 'loyer' })"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-xs font-semibold flex items-center gap-1.5 mx-auto">
          <Icon icon="lucide:plus" class="w-3.5 h-3.5" /> Saisir une dépense
        </button>
      </div>

      <div v-else class="space-y-4">
        <div v-for="g in groups" :key="g.category" class="bg-surface border border-border rounded-xl overflow-hidden">
          <div class="flex items-center gap-2.5 px-4 py-2.5 bg-surface2/50 border-b border-border">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: catOf(g.category).color + '1f' }">
              <Icon :icon="catOf(g.category).icon" class="w-3.5 h-3.5" :style="{ color: catOf(g.category).color }" />
            </div>
            <span class="text-sm font-semibold flex-1 min-w-0 truncate">{{ catOf(g.category).label }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-surface2 text-text-muted flex-shrink-0">{{ g.items.length }}</span>
            <span class="text-sm font-bold flex-shrink-0" :class="g.bucket === 'income' ? 'text-mint' : ''">
              {{ g.bucket === 'income' ? '+' : '' }}{{ eur(g.total) }}
            </span>
          </div>
          <div class="divide-y divide-border/60">
            <div v-for="r in g.items" :key="r.id" class="exp-row flex items-center gap-3 px-4 py-2.5 hover:bg-surface2/40 transition-colors">
              <span class="w-12 text-[11px] text-text-muted flex-shrink-0">{{ shortDate(r.spent_on) }}</span>
              <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(r)">
                <p class="text-sm truncate flex items-center gap-1.5">
                  {{ r.label }}
                  <Icon v-if="r.recurring" icon="lucide:repeat" class="w-3 h-3 text-text-muted flex-shrink-0" />
                  <Icon v-if="r.source === 'auto'" icon="lucide:sparkles" class="w-3 h-3 text-lavender flex-shrink-0" />
                </p>
                <p v-if="r.notes" class="text-[11px] text-text-muted truncate">{{ r.notes }}</p>
              </div>
              <span class="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                :style="{ background: ownerOf(r.owner_id).color }" :title="ownerOf(r.owner_id).name">
                {{ ownerOf(r.owner_id).name.charAt(0) }}
              </span>
              <span class="text-sm font-semibold flex-shrink-0 w-20 text-right" :class="g.bucket === 'income' ? 'text-mint' : ''">{{ eur2(r.amount) }}</span>
              <button @click.stop="pendingDelete = r.id" class="p-1.5 text-text-muted hover:text-rose transition-colors flex-shrink-0" aria-label="Supprimer">
                <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div v-if="pendingDelete && g.items.some(x => x.id === pendingDelete)" class="flex items-center gap-2 bg-rose/5 border-t border-rose/20 px-4 py-2">
            <p class="text-xs flex-1">Supprimer cette ligne ?</p>
            <button @click.stop="pendingDelete = null" class="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:bg-surface2 transition-colors">Annuler</button>
            <button @click.stop="removeExpense(pendingDelete)" class="px-3 py-1 rounded-lg bg-rose text-white text-xs font-semibold hover:bg-rose-soft transition-colors">Supprimer</button>
          </div>
        </div>

        <p class="text-[11px] text-text-muted flex items-start gap-1.5">
          <Icon icon="lucide:info" class="w-3.5 h-3.5 mt-px flex-shrink-0 text-lavender" />
          <span>Les lignes marquées <Icon icon="lucide:repeat" class="w-3 h-3 inline" /> sont récurrentes : elles sont recréées
            chaque mois au même jour, avec le dernier montant connu. Modifie le montant du mois en cours pour changer
            celui des mois suivants.</span>
        </p>
      </div>
    </template>

    <!-- ------------------------------------------------------------ BILAN -->
    <BusinessExpensesReport v-else ref="reportRef" />
  </div>

  <!-- Modale saisie -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
        <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
        <div class="relative w-full sm:max-w-lg bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe-lg">
          <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
            <Icon :icon="catOf(form.category).icon" class="w-5 h-5" :style="{ color: catOf(form.category).color }" />
            {{ editing ? 'Modifier la ligne' : 'Nouvelle ligne' }}
          </h3>

          <form @submit.prevent="onSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-text-muted mb-1">Quoi *</label>
              <input v-model="form.label" required placeholder="Loyer, Intermarché, assurance auto..."
                class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Catégorie</label>
                <select v-model="form.category" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                  <optgroup v-for="grp in grouped.filter(g => g.cats.length)" :key="grp.key" :label="grp.label">
                    <option v-for="c in grp.cats" :key="c.key" :value="c.key">{{ c.label }}</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Montant (€)</label>
                <input v-model="form.amount" type="number" min="0" step="0.01" required placeholder="0,00"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
              </div>
            </div>

            <p class="text-[11px] text-text-muted flex items-center gap-1.5 -mt-1">
              <Icon :icon="formBucket.icon" class="w-3.5 h-3.5" :style="{ color: formBucket.color }" />
              Compté comme <b class="text-text">{{ formBucket.label }}</b>
              <span v-if="['epargne', 'investissement'].includes(form.category)"> — pas une dépense, un transfert vers ton patrimoine</span>
            </p>

            <div>
              <label class="block text-sm font-medium text-text-muted mb-1">À qui</label>
              <div class="flex gap-2">
                <button v-for="o in OWNERS" :key="String(o.id)" type="button" @click="form.owner_id = o.id"
                  class="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center justify-center gap-2"
                  :class="(form.owner_id ?? null) === o.id ? 'bg-surface2 border-rose/40 text-text' : 'bg-surface2/50 border-border text-text-muted hover:text-text'">
                  <span class="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold text-white" :style="{ background: o.color }">{{ o.name.charAt(0) }}</span>
                  {{ o.name }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Date</label>
                <input v-model="form.spent_on" type="date"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50" />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Paiement</label>
                <select v-model="form.payment" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50">
                  <option v-for="p in PAYMENTS" :key="p.key" :value="p.key">{{ p.label }}</option>
                </select>
              </div>
            </div>

            <div class="bg-surface2/60 border border-border rounded-xl p-3.5">
              <label class="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" v-model="form.recurring" class="w-4 h-4 accent-rose rounded" />
                <span class="text-sm font-medium">Chaque mois</span>
                <span class="text-[11px] text-text-muted">(loyer, abonnements, salaire...)</span>
              </label>
              <div v-if="form.recurring" class="flex items-center gap-2 mt-3">
                <label class="text-xs text-text-muted">Le</label>
                <input v-model="form.recur_day" type="number" min="1" max="28"
                  class="w-16 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-rose/50" />
                <span class="text-xs text-text-muted">du mois</span>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-text-muted mb-1">Notes</label>
              <textarea v-model="form.notes" rows="2" placeholder="Détail, magasin, référence..."
                class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors resize-none" />
            </div>

            <div class="flex gap-3 pt-2">
              <button type="button" @click="showModal = false"
                class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
              <button type="submit" :disabled="saving"
                class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
                <Icon :icon="saving ? 'lucide:loader-circle' : (editing ? 'lucide:save' : 'lucide:plus')" class="w-4 h-4" :class="{ 'animate-spin': saving }" />
                {{ editing ? 'Enregistrer' : 'Ajouter' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
</style>
