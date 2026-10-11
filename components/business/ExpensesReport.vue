<script setup lang="ts">
import { EXPENSE_CATS as CATS, EXPENSE_BUCKETS as BUCKETS } from '~/utils/expenseCatalog'

// Bilan généré : tout le calcul (score, ratios, conseils) vient du serveur
// (businessExpenses.buildReport) — ici on ne fait que dessiner et expliquer.
const api = useApi()

const period = ref(6)
const data = ref<any>(null)
const loading = ref(true)
const busy = ref(false)
const errorMsg = ref('')

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
const pct = (n: any) => (n === null || n === undefined ? '—' : `${Math.round(Number(n) * 100)} %`)
const catOf = (k: string) => CATS.find(c => c.key === k) || CATS[CATS.length - 1]
const bucketOf = (k: string) => BUCKETS.find(b => b.key === k) || BUCKETS[2]

async function load() {
  loading.value = true
  try {
    data.value = await api.fetchExpenseReport(period.value)
    syncDrafts()
    errorMsg.value = ''
  } catch (err: any) {
    data.value = null
    errorMsg.value = 'Bilan indisponible : ' + (err?.data?.message || 'réessaie dans un instant.')
  }
  loading.value = false
}

onMounted(load)
watch(period, load)

const kpis = computed(() => data.value?.kpis || {})
const score = computed(() => data.value?.score || null)
const insights = computed<any[]>(() => data.value?.insights || [])
const categories = computed<any[]>(() => data.value?.categories || [])
const budgets = computed<any[]>(() => data.value?.budgets || [])
const budgetByCat = computed(() => new Map(budgets.value.map((b: any) => [b.category, b])))
const entriesPeriod = computed(() => Number(kpis.value.entriesPeriod) || 0)

/* ------------------------------------------------------------------- score */

const RING = 2 * Math.PI * 42
const ring = computed(() => {
  const s = score.value
  if (!s) return null
  // le score peut avoir un total maximal différent de 100 quand les revenus manquent
  const pctVal = Math.max(0, Math.min(100, s.total / Math.max(1, s.max) * 100))
  return { dash: RING, offset: RING * (1 - pctVal / 100), pctVal }
})
const scoreColor = computed(() => {
  const s = score.value
  if (!s) return '#8888a0'
  const v = (s.total / Math.max(1, s.max)) * 100
  return v >= 80 ? '#4adec0' : v >= 60 ? '#4da6ff' : v >= 40 ? '#f0c060' : '#ff6b8a'
})

const dimColor = (d: any) => {
  const r = d.points / d.max
  return r >= 0.8 ? '#4adec0' : r >= 0.5 ? '#f0c060' : '#ff6b8a'
}

/* ------------------------------------------------------- graphique mensuel */

const chart = computed(() => {
  const m = data.value?.monthly || []
  if (!m.length) return null
  const W = 600, H = 170, TOP = 10, BASE = H - 4
  const maxRef = Math.max(1, ...m.map((x: any) => Math.max(Number(x.income) || 0, Number(x.expense) || 0)))
  const step = W / m.length
  const barW = Math.min(58, step * 0.62)
  const y = (v: number) => BASE - (v / maxRef) * (BASE - TOP)
  const segOrder: [string, string][] = [['fixed', '#ff6b8a'], ['variable', '#a78bfa'], ['travel', '#f0c060']]
  const bars = m.map((x: any, i: number) => {
    const cx = i * step + step / 2
    const segs: any[] = []
    let acc = 0
    for (const [key, color] of segOrder) {
      const v = Number(x[key]) || 0
      if (v <= 0) continue
      segs.push({ key, color, x: cx - barW / 2, y: BASE - ((acc + v) / maxRef) * (BASE - TOP), w: barW, h: (v / maxRef) * (BASE - TOP) })
      acc += v
    }
    return {
      month: x.month, label: x.label, cx, segs, ref: barW / 2 + 3,
      incomeY: y(Number(x.income) || 0), income: Number(x.income) || 0,
      expense: Number(x.expense) || 0, saved: Number(x.saved) || 0, isCurrent: i === m.length - 1,
    }
  })
  return { W, H, bars, maxRef, baseY: BASE, midY: (BASE + TOP) / 2 }
})

/* ------------------------------------------------------------- repère 50/30/20 */

const rule = computed(() => {
  const k = kpis.value
  if (!k?.hasIncome) return null
  const bars = [
    { key: 'needs', label: 'Besoins', real: k.needsRatio || 0, target: 0.5, amount: k.needs, color: '#4da6ff', icon: 'lucide:house' },
    { key: 'wants', label: 'Envies', real: k.wantsRatio || 0, target: 0.3, amount: k.wants, color: '#a78bfa', icon: 'lucide:party-popper' },
    { key: 'savings', label: 'Épargne', real: k.savedRate || 0, target: 0.2, amount: k.saved, color: '#4adec0', icon: 'lucide:piggy-bank' },
  ]
  const scaleMax = Math.max(0.6, ...bars.map(b => Math.max(b.real, b.target))) * 1.1
  return {
    income: k.incomeRef,
    bars: bars.map(b => ({
      ...b,
      width: Math.min(100, (b.real / scaleMax) * 100),
      mark: (b.target / scaleMax) * 100,
      delta: b.real - b.target,
    })),
  }
})

/* --------------------------------------------------------------- répartition */

const totalExpense = computed(() => Number(kpis.value.expense) || 0)
const breakdown = computed(() => categories.value
  .filter((c: any) => ['fixed', 'variable', 'travel'].includes(c.bucket) && c.current > 0)
  .map((c: any) => ({ ...c, share: totalExpense.value > 0 ? (c.current / totalExpense.value) * 100 : 0, budget: budgetByCat.value.get(c.category) || null }))
  .sort((a: any, b: any) => b.current - a.current))

const flux = computed(() => {
  const k = kpis.value
  if (!k?.hasIncome && !k?.expense) return null
  const items = [
    { label: 'Revenus', value: k.incomeRef || k.income, color: '#6fcf97', icon: 'lucide:arrow-down-left' },
    { label: 'Charges fixes', value: -k.fixed, color: '#ff6b8a', icon: 'lucide:house' },
    { label: 'Variable', value: -k.variable, color: '#a78bfa', icon: 'lucide:shopping-cart' },
  ]
  if (k.travel > 0) items.push({ label: 'Voyage', value: -k.travel, color: '#f0c060', icon: 'lucide:plane' })
  if (k.savings > 0) items.push({ label: 'Épargne', value: -k.savings, color: '#4adec0', icon: 'lucide:piggy-bank' })
  if (k.investment > 0) items.push({ label: 'Invest.', value: -k.investment, color: '#4da6ff', icon: 'lucide:trending-up' })
  return { items, reste: k.balance, cash: k.cash }
})

/* ----------------------------------------------------------------- plafonds */

const budgetDraft = reactive<Record<string, any>>({})
function syncDrafts() {
  for (const b of data.value?.budgets || []) budgetDraft[b.category] = b.budget
}
const addForm = reactive({ category: 'loisirs', amount: '' as any })
const budgetable = computed(() => CATS.filter(c => c.bucket !== 'income'))
const addable = computed(() => budgetable.value.filter(c => !budgetByCat.value.has(c.key)))

async function saveBudget(category: string, amount: any) {
  const value = Number(amount)
  const current = budgets.value.find((b: any) => b.category === category)
  if (!Number.isFinite(value) || value < 0) return
  if (current && Number(current.budget) === value) return
  busy.value = true
  try {
    await api.saveExpenseBudget(category, value)
    await load()
  } catch { errorMsg.value = 'Plafond non enregistré.' } finally { busy.value = false }
}

async function removeBudget(category: string) {
  busy.value = true
  try {
    await api.saveExpenseBudget(category, 0)
    delete budgetDraft[category]
    await load()
  } catch { errorMsg.value = 'Suppression impossible.' } finally { busy.value = false }
}

async function addBudget() {
  if (!Number.isFinite(Number(addForm.amount)) || Number(addForm.amount) <= 0) return
  await saveBudget(addForm.category, addForm.amount)
  addForm.amount = ''
}

/* ------------------------------------------------------------- présentation */

const SEVERITY: Record<string, { bg: string; border: string; text: string; label: string }> = {
  alert: { bg: 'bg-rose/8', border: 'border-rose/30', text: 'text-rose', label: 'À corriger' },
  warn: { bg: 'bg-gold/8', border: 'border-gold/30', text: 'text-gold', label: 'Vigilance' },
  info: { bg: 'bg-lavender/8', border: 'border-lavender/30', text: 'text-lavender', label: 'À savoir' },
  ok: { bg: 'bg-mint/8', border: 'border-mint/30', text: 'text-mint', label: 'Bon point' },
}
const sev = (s: string) => SEVERITY[s] || SEVERITY.info

const owners = computed<any[]>(() => {
  const rows = data.value?.owners?.rows || []
  const total = Number(data.value?.owners?.declaredExpense) || 0
  return rows.map((o: any) => ({
    ...o,
    label: o.owner_id ? o.name : 'Nous deux',
    share: total > 0 ? (o.expense / total) * 100 : 0,
  }))
})
</script>

<template>
  <div class="space-y-5">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-bold flex items-center gap-2">
          <Icon icon="lucide:presentation" class="w-4 h-4 text-rose" />
          Bilan de gestion
        </h2>
        <p class="text-text-muted text-xs mt-0.5">
          <template v-if="data">Généré à partir de {{ entriesPeriod }} saisie{{ entriesPeriod > 1 ? 's' : '' }}
            · {{ data.period.label }}</template>
          <template v-else>Score, graphiques et conseils à partir de tes saisies</template>
        </p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-1 flex gap-1 flex-shrink-0">
        <button v-for="p in [3, 6, 12]" :key="p" @click="period = p"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="period === p ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text'">
          {{ p }} mois
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{{ errorMsg }}</p>

    <div v-if="loading" class="text-center py-12 text-text-muted text-sm">
      <Icon icon="lucide:loader-circle" class="w-7 h-7 mx-auto animate-spin mb-2" /> Calcul du bilan...
    </div>

    <!-- Rien à analyser -->
    <div v-else-if="!data || entriesPeriod === 0" class="bg-surface/50 border border-dashed border-border rounded-xl p-8 text-center">
      <Icon icon="lucide:line-chart" class="w-7 h-7 mx-auto mb-2 text-text-muted opacity-50" />
      <p class="text-sm font-medium mb-1">Le bilan se construira avec tes premières saisies</p>
      <p class="text-xs text-text-muted max-w-md mx-auto">
        Saisis au moins un mois complet (revenus + charges fixes + dépenses courantes) dans l'onglet
        <b class="text-text">Suivi</b> : le score, les graphiques et les conseils apparaissent immédiatement.
      </p>
    </div>

    <template v-else>
      <!-- Score -->
      <div v-if="score" class="bg-gradient-to-br from-surface to-surface2 border border-border rounded-2xl p-5">
        <div class="flex flex-col sm:flex-row items-center gap-5">
          <div class="relative w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 100 100" class="w-28 h-28 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#242436" stroke-width="9" />
              <circle cx="50" cy="50" r="42" fill="none" :stroke="scoreColor" stroke-width="9" stroke-linecap="round"
                :stroke-dasharray="ring.dash" :stroke-dashoffset="ring.offset" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-2xl font-bold leading-none">{{ Math.round(score.total) }}</span>
              <span class="text-[10px] text-text-muted">/ {{ Math.round(score.max) }}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0 w-full">
            <p class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Santé de gestion</p>
            <p class="text-lg font-bold mb-3" :style="{ color: scoreColor }">{{ score.label }}
              <span class="text-text-muted text-sm font-medium">— {{ ring.pctVal.toFixed(0) }} % des critères</span>
            </p>
            <div class="space-y-2.5">
              <div v-for="d in score.dimensions" :key="d.key">
                <div class="flex items-baseline justify-between gap-2 text-xs mb-1">
                  <span class="font-medium">{{ d.label }}</span>
                  <span class="text-text-muted flex-shrink-0">{{ d.points }}/{{ d.max }}</span>
                </div>
                <div class="h-1.5 rounded-full bg-surface2 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-700"
                    :style="{ width: Math.max(3, (d.points / d.max) * 100) + '%', background: dimColor(d) }" />
                </div>
                <p class="text-[11px] text-text-muted mt-0.5">{{ d.detail }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Flux du mois : l'arithmétique en clair -->
        <div v-if="flux" class="mt-5 pt-4 border-t border-border">
          <p class="text-[11px] uppercase tracking-wide text-text-muted font-semibold mb-2">Flux du mois</p>
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span v-for="(f, i) in flux.items" :key="f.label" class="flex items-center gap-1.5">
              <span v-if="i > 0" class="text-text-muted px-0.5">−</span>
              <span class="px-2 py-1 rounded-lg border border-border bg-surface flex items-center gap-1.5">
                <Icon :icon="f.icon" class="w-3 h-3" :style="{ color: f.color }" />
                {{ f.label }} <b>{{ eur(Math.abs(f.value)) }}</b>
              </span>
            </span>
            <span class="text-text-muted px-0.5">=</span>
            <span class="px-2 py-1 rounded-lg border font-semibold flex items-center gap-1.5"
              :class="(flux.reste ?? 0) >= 0 ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose/30 bg-rose/10 text-rose'">
              <Icon icon="lucide:equal" class="w-3 h-3" /> Reste {{ eur(flux.reste) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Conseils -->
      <div class="bg-surface border border-border rounded-2xl p-5">
        <h3 class="text-sm font-bold flex items-center gap-2 mb-1">
          <Icon icon="lucide:lightbulb" class="w-4 h-4 text-gold" />
          Conseils sur ta gestion
        </h3>
        <p class="text-[11px] text-text-muted mb-4">Chaque conseil est calculé sur tes chiffres du mois — pas de généralités.</p>

        <div v-if="insights.length === 0" class="text-xs text-text-muted py-3">Aucun signal particulier ce mois-ci.</div>

        <div v-else class="space-y-2.5">
          <div v-for="(ins, i) in insights" :key="i" class="rounded-xl border p-3.5 flex items-start gap-3"
            :class="[sev(ins.severity).bg, sev(ins.severity).border]">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              :class="sev(ins.severity).bg">
              <Icon :icon="ins.icon" class="w-4 h-4" :class="sev(ins.severity).text" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold flex items-center gap-2 flex-wrap">
                {{ ins.title }}
                <span class="text-[10px] px-1.5 py-0.5 rounded-md border font-medium"
                  :class="[sev(ins.severity).text, sev(ins.severity).border]">{{ sev(ins.severity).label }}</span>
              </p>
              <p class="text-xs text-text-muted mt-1 leading-relaxed">{{ ins.text }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Graphique mensuel -->
      <div v-if="chart" class="bg-surface border border-border rounded-xl p-5">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 class="text-sm font-bold flex items-center gap-2">
              <Icon icon="lucide:chart-column" class="w-4 h-4 text-lavender" />
              Dépenses par mois
            </h3>
            <p class="text-[11px] text-text-muted mt-0.5">Barres empilées : charges fixes, variable, voyage. Repère <span class="text-mint">— revenus</span>.</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-[11px] text-text-muted">Max</p>
            <p class="text-sm font-bold">{{ eur(chart.maxRef) }}</p>
          </div>
        </div>

        <svg :viewBox="`0 0 ${chart.W} ${chart.H}`" preserveAspectRatio="none" class="w-full h-40 sm:h-52">
          <!-- grille : 50 % du max -->
          <line x1="0" :y1="chart.midY" :x2="chart.W" :y2="chart.midY" stroke="#2a2a3e" stroke-width="1"
            stroke-dasharray="6 8" vector-effect="non-scaling-stroke" />
          <line x1="0" :y1="chart.baseY" :x2="chart.W" :y2="chart.baseY" stroke="#2a2a3e" stroke-width="1" vector-effect="non-scaling-stroke" />
          <g v-for="b in chart.bars" :key="b.month">
            <rect v-for="s in b.segs" :key="s.key" :x="s.x" :y="s.y" :width="s.w" :height="s.h" :fill="s.color"
              :opacity="b.isCurrent ? 1 : 0.55" />
            <!-- repère du revenu du mois -->
            <rect v-if="b.income > 0" :x="b.cx - 9" :y="b.incomeY - 1" width="18" height="2" fill="#4adec0" />
          </g>
        </svg>
        <div class="flex mt-1.5">
          <div v-for="b in chart.bars" :key="b.month" class="flex-1 text-center min-w-0">
            <p class="text-[10px]" :class="b.isCurrent ? 'text-text font-semibold' : 'text-text-muted'">{{ b.label }}</p>
            <p class="text-[10px] text-text-muted/80 truncate">{{ eur(b.expense) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border">
          <span v-for="b in BUCKETS.filter(x => ['fixed', 'variable', 'travel'].includes(x.key))" :key="b.key" class="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: b.color }" /> {{ b.label }}
          </span>
          <span class="flex items-center gap-1.5 text-[11px] text-mint">
            <span class="w-4 h-0.5 rounded-full bg-mint" /> Revenus du mois
          </span>
        </div>
      </div>

      <!-- Repère 50/30/20 -->
      <div v-if="rule" class="bg-surface border border-border rounded-xl p-5">
        <h3 class="text-sm font-bold flex items-center gap-2 mb-1">
          <Icon icon="lucide:scale" class="w-4 h-4 text-mint" />
          Repère 50 / 30 / 20
        </h3>
        <p class="text-[11px] text-text-muted mb-4">
          Sur {{ eur(rule.income) }} de revenus mensuels : la barre montre ta réalité, le trait vertical la cible.
        </p>
        <div class="space-y-4">
          <div v-for="b in rule.bars" :key="b.key">
            <div class="flex items-baseline justify-between gap-2 text-xs mb-1.5">
              <span class="font-medium flex items-center gap-1.5">
                <Icon :icon="b.icon" class="w-3.5 h-3.5" :style="{ color: b.color }" />
                {{ b.label }}
                <span class="text-text-muted">cible {{ Math.round(b.target * 100) }} %</span>
              </span>
              <span class="flex-shrink-0">
                <b :style="{ color: b.color }">{{ Math.round(b.real * 100) }} %</b>
                <span class="text-text-muted">· {{ eur(b.amount) }}</span>
                <span class="ml-1 text-[10px]" :class="b.delta >= 0 ? 'text-mint' : 'text-rose'">
                  {{ b.delta >= 0 ? '+' : '' }}{{ Math.round(b.delta * 100) }} pts
                </span>
              </span>
            </div>
            <div class="relative h-2.5 rounded-full bg-surface2 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :style="{ width: b.width + '%', background: b.color }" />
              <div class="absolute top-0 bottom-0 w-0.5 bg-text/70" :style="{ left: b.mark + '%' }" />
            </div>
          </div>
        </div>
      </div>

      <!-- Répartition du mois -->
      <div class="bg-surface border border-border rounded-xl p-5">
        <div class="flex items-start justify-between gap-3 mb-3">
          <h3 class="text-sm font-bold flex items-center gap-2">
            <Icon icon="lucide:chart-pie" class="w-4 h-4 text-rose" />
            Où part l'argent ce mois
          </h3>
          <span class="text-sm font-bold flex-shrink-0">{{ eur(totalExpense) }}</span>
        </div>

        <div v-if="breakdown.length === 0" class="text-xs text-text-muted py-3">Aucune dépense sur le mois en cours.</div>

        <template v-else>
          <div class="h-2.5 rounded-full overflow-hidden flex bg-surface2 mb-4">
            <div v-for="b in breakdown" :key="b.category" class="h-full" :style="{ width: b.share + '%', background: catOf(b.category).color }" :title="b.label" />
          </div>
          <ul class="space-y-2.5">
            <li v-for="b in breakdown" :key="b.category">
              <div class="flex items-center gap-2.5 text-xs">
                <Icon :icon="catOf(b.category).icon" class="w-3.5 h-3.5 flex-shrink-0" :style="{ color: catOf(b.category).color }" />
                <span class="flex-1 min-w-0 truncate">
                  {{ b.label }}
                  <span class="text-text-muted">
                    ({{ b.count }} ligne{{ b.count > 1 ? 's' : '' }}<template v-if="b.trend !== null">, {{ b.trend >= 0 ? '+' : '' }}{{ Math.round(b.trend * 100) }} % vs moyenne</template>)
                  </span>
                </span>
                <span class="text-text-muted flex-shrink-0 w-10 text-right">{{ Math.round(b.share) }} %</span>
                <span class="font-semibold flex-shrink-0 w-20 text-right">{{ eur(b.current) }}</span>
              </div>
              <div v-if="b.budget && b.budget.budget > 0" class="flex items-center gap-2 mt-1.5 pl-6">
                <div class="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
                  <div class="h-full rounded-full" :style="{ width: Math.min(100, b.budget.pct) + '%', background: b.budget.over > 0 ? '#ff6b8a' : '#4adec0' }" />
                </div>
                <span class="text-[10px] flex-shrink-0" :class="b.budget.over > 0 ? 'text-rose font-semibold' : 'text-text-muted'">
                  plafond {{ eur(b.budget.budget) }}<template v-if="b.budget.over > 0"> · +{{ eur(b.budget.over) }}</template>
                </span>
              </div>
            </li>
          </ul>
        </template>
      </div>

      <!-- Qui dépense quoi -->
      <div class="bg-surface border border-border rounded-xl p-5">
        <h3 class="text-sm font-bold flex items-center gap-2 mb-1">
          <Icon icon="lucide:users" class="w-4 h-4 text-gold" />
          Qui déclare quoi
        </h3>
        <p class="text-[11px] text-text-muted mb-4">Chaque ligne saisie est rattachée à une personne ou au couple.</p>

        <div v-if="owners.length === 0" class="text-xs text-text-muted py-2">Aucune saisie sur le mois en cours.</div>

        <div v-else class="space-y-3">
          <div v-for="o in owners" :key="o.owner_id" class="bg-surface2/50 rounded-xl p-3.5">
            <div class="flex items-center gap-2.5 mb-2.5">
              <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                :style="{ background: o.color }">{{ String(o.label).charAt(0) }}</span>
              <span class="text-sm font-semibold flex-1 min-w-0 truncate">{{ o.label }}</span>
              <span class="text-xs text-text-muted flex-shrink-0">{{ o.entries }} ligne{{ o.entries > 1 ? 's' : '' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center mb-2">
              <div>
                <p class="text-[10px] text-text-muted uppercase tracking-wide">Dépensé</p>
                <p class="text-sm font-bold">{{ eur(o.expense) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-text-muted uppercase tracking-wide">Mis de côté</p>
                <p class="text-sm font-bold text-gold">{{ eur(o.saved) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-text-muted uppercase tracking-wide">Revenus</p>
                <p class="text-sm font-bold text-mint">{{ eur(o.income) }}</p>
              </div>
            </div>
            <div class="h-1.5 rounded-full bg-surface overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :style="{ width: o.share + '%', background: o.color }" />
            </div>
            <p class="text-[10px] text-text-muted mt-1">{{ Math.round(o.share) }} % des dépenses déclarées du mois</p>
          </div>
        </div>
      </div>

      <!-- Plafonds -->
      <div class="bg-surface border border-border rounded-xl p-5">
        <h3 class="text-sm font-bold flex items-center gap-2 mb-1">
          <Icon icon="lucide:target" class="w-4 h-4 text-rose" />
          Plafonds mensuels
        </h3>
        <p class="text-[11px] text-text-muted mb-4">
          Un plafond par poste : dès qu'il est franchi, le bilan te le signale. Mets 0 pour le retirer.
        </p>

        <div v-if="budgets.length === 0" class="text-xs text-text-muted mb-3">
          Aucun plafond pour l'instant — commence par les postes où tu as le plus de marge.
        </div>

        <div class="space-y-2 mb-4">
          <div v-for="b in budgets" :key="b.category" class="flex items-center gap-2.5 bg-surface2/50 rounded-xl p-2.5">
            <Icon :icon="catOf(b.category).icon" class="w-4 h-4 flex-shrink-0" :style="{ color: catOf(b.category).color }" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate">{{ b.label }}</p>
              <p class="text-[10px]" :class="b.over > 0 ? 'text-rose' : 'text-text-muted'">
                {{ eur(b.spent) }} dépensés · {{ Math.round(b.pct) }} %<template v-if="b.over > 0"> · +{{ eur(b.over) }}</template>
              </p>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <input v-model="budgetDraft[b.category]" type="number" min="0" step="10" :disabled="busy"
                @change="saveBudget(b.category, budgetDraft[b.category])"
                class="w-20 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text text-right focus:outline-none focus:border-rose/50" />
              <span class="text-[10px] text-text-muted">€/mois</span>
              <button @click="removeBudget(b.category)" :disabled="busy"
                class="p-1.5 text-text-muted hover:text-rose transition-colors" aria-label="Retirer le plafond">
                <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="addable.length" class="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
          <select v-model="addForm.category" class="bg-surface2 border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-rose/50">
            <option v-for="c in addable" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
          <input v-model="addForm.amount" type="number" min="0" step="10" placeholder="Montant"
            class="w-28 bg-surface2 border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-rose/50" />
          <button @click="addBudget" :disabled="busy || !Number(addForm.amount)"
            class="px-3 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <Icon icon="lucide:plus" class="w-3.5 h-3.5" /> Définir
          </button>
        </div>
      </div>

      <!-- Charges récurrentes -->
      <div v-if="data.recurring.rows.length" class="bg-surface border border-border rounded-xl p-5">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 class="text-sm font-bold flex items-center gap-2">
              <Icon icon="lucide:repeat" class="w-4 h-4 text-gold" />
              Charges récurrentes
            </h3>
            <p class="text-[11px] text-text-muted mt-0.5">Engagements mensuels recréés automatiquement (dernier montant connu).</p>
          </div>
          <span class="text-sm font-bold flex-shrink-0">{{ eur(data.recurring.total) }}<span class="text-[11px] text-text-muted font-normal">/mois</span></span>
        </div>
        <ul class="space-y-1.5">
          <li v-for="r in data.recurring.rows" :key="r.id" class="flex items-center gap-2.5 text-xs">
            <Icon :icon="catOf(r.category).icon" class="w-3.5 h-3.5 flex-shrink-0" :style="{ color: catOf(r.category).color }" />
            <span class="flex-1 min-w-0 truncate">
              {{ r.label }}
              <span class="text-text-muted">· {{ r.label_cat }} · le {{ r.recur_day }}</span>
            </span>
            <span v-if="r.bucket === 'income'" class="text-[10px] px-1.5 py-0.5 rounded-md bg-mint/10 text-mint flex-shrink-0">revenu</span>
            <span v-else class="text-[10px] px-1.5 py-0.5 rounded-md bg-surface2 text-text-muted flex-shrink-0">{{ r.shared ? 'commun' : 'perso' }}</span>
            <span class="font-semibold flex-shrink-0 w-20 text-right" :class="r.bucket === 'income' ? 'text-mint' : ''">{{ eur(r.amount) }}</span>
          </li>
        </ul>
      </div>

      <p class="text-[11px] text-text-muted flex items-start gap-1.5">
        <Icon icon="lucide:calculator" class="w-3.5 h-3.5 mt-px flex-shrink-0" />
        <span>
          Bilan calculé sur les {{ data.period.months }} derniers mois ({{ data.period.label }}), revenus de référence
          {{ eur(kpis.incomeRef) }}<template v-if="!kpis.hasIncome"> — non renseigné : les ratios et le score sont partiels</template>.
          Ce sont des repères de gestion, pas un conseil en investissement.
        </span>
      </p>
    </template>
  </div>
</template>
