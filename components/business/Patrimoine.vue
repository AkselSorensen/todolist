<script setup lang="ts">
// Patrimoine global d'une personne : ce qui est à son nom, + ce qui est en commun.
const props = defineProps<{ personId: number }>()

const api = useApi()

const OWNERS: Record<number, { name: string; color: string }> = {
  4: { name: 'Aksel', color: '#4da6ff' },
  5: { name: 'Amandine', color: '#ff6b8a' },
}
const person = computed(() => OWNERS[props.personId] || OWNERS[4])

const CATEGORIES = [
  { key: 'crypto', label: 'Crypto', icon: 'lucide:bitcoin', color: '#f0c060' },
  { key: 'stocks', label: 'Bourse', icon: 'lucide:chart-line', color: '#a78bfa' },
  { key: 'real_estate', label: 'Immobilier', icon: 'lucide:building-2', color: '#ff6b8a' },
  { key: 'savings', label: 'Épargne', icon: 'lucide:piggy-bank', color: '#4adec0' },
  { key: 'business', label: 'Parts de société', icon: 'lucide:briefcase', color: '#4da6ff' },
  { key: 'other', label: 'Autre', icon: 'lucide:package', color: '#8888a0' },
]

const assetsRef = ref<any>(null)
defineExpose({ openCreate: () => assetsRef.value?.openCreate() })

const mine = ref<any[]>([])
const common = ref<any[]>([])
const snapshots = ref<any[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [m, c] = await Promise.all([
      api.fetchBusinessAssets({ owner: props.personId }),
      api.fetchBusinessAssets({ owner: 'common' }),
    ])
    mine.value = m || []
    common.value = c || []
  } catch {
    mine.value = []
    common.value = []
  }
  try {
    const snap = await api.fetchBusinessSnapshots(12)
    // une ligne par (mois, propriétaire) -> on ne garde que la personne
    snapshots.value = (snap?.rows || [])
      .filter((r: any) => (r.owner_id ?? null) === props.personId)
      .map((r: any) => ({ month: String(r.month).slice(0, 10), total: Number(r.total) || 0, assets: Number(r.assets_count) || 0 }))
      .sort((a: any, b: any) => a.month < b.month ? -1 : 1)
  } catch {
    snapshots.value = []
  }
  loading.value = false
}

onMounted(load)
watch(() => props.personId, load)

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0)

const total = computed(() => mine.value.reduce((s, a) => s + (Number(a.value) || 0), 0))
const commonTotal = computed(() => common.value.reduce((s, a) => s + (Number(a.value) || 0), 0))
const biggest = computed(() => mine.value.slice().sort((a, b) => b.value - a.value)[0] || null)

/* ---- Évolution : courbe, progression, projection ---- */
const monthLabel = (m: string) => new Date(m + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

const chart = computed(() => {
  const pts = snapshots.value
  if (pts.length < 2) return null
  const vals = pts.map(p => p.total)
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const span = max - min || Math.max(1, Math.abs(max)) || 1   // tout plat -> pas de division par 0
  const W = 600, H = 150, PAD = 10
  const x = (i: number) => (pts.length === 1 ? 0 : (i / (pts.length - 1)) * W)
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2)
  const coords = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`)
  return {
    W, H,
    line: coords.join(' '),
    area: `M 0,${H} L ` + coords.join(' L ') + ` L ${W},${H} Z`,
    first: pts[0],
    last: pts[pts.length - 1],
    gradientId: 'patGrad' + props.personId,
  }
})

const evolution = computed(() => {
  const s = snapshots.value
  if (s.length < 2) return null
  const first = s[0].total
  const last = s[s.length - 1].total
  const delta = last - first
  const months = s.length - 1
  // pente par moindres carrés : plus juste qu'une simple moyenne quand les mois sont irréguliers
  const n = s.length
  const sx = (n - 1) * n / 2
  const sxx = (n - 1) * n * (2 * n - 1) / 6
  const sy = s.reduce((a, p) => a + p.total, 0)
  const sxy = s.reduce((a, p, i) => a + i * p.total, 0)
  const denom = n * sxx - sx * sx
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0
  return {
    first, last, delta, months, slope,
    pct: first > 0 ? (delta / first) * 100 : null,
    perMonth: months > 0 ? delta / months : 0,
  }
})

// projection seulement si la pente est positive ET qu'on a au moins 3 relevés (sinon c'est du bruit)
const projection = computed(() => {
  const e = evolution.value
  if (!e || snapshots.value.length < 3 || e.slope <= 0) return null
  return { fiveYears: Math.round(e.last + e.slope * 60), perMonth: Math.round(e.slope) }
})

const breakdown = computed(() => CATEGORIES.map(c => {
  const items = mine.value.filter(a => a.category === c.key)
  const sum = items.reduce((s, a) => s + (Number(a.value) || 0), 0)
  return { ...c, sum, count: items.length, pct: total.value > 0 ? (sum / total.value) * 100 : 0 }
}).filter(b => b.sum > 0))
</script>

<template>
  <div class="space-y-5">
    <!-- Patrimoine global -->
    <div class="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface2 p-5">
      <div class="flex items-center gap-3 mb-4">
        <span class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          :style="{ background: person.color }">{{ person.name.charAt(0) }}</span>
        <div class="min-w-0">
          <p class="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Patrimoine global</p>
          <p class="text-base font-bold truncate">{{ person.name }}</p>
        </div>
      </div>

      <div v-if="loading" class="py-6 text-center text-text-muted text-sm">
        <Icon icon="lucide:loader-circle" class="w-6 h-6 mx-auto animate-spin mb-2" />Chargement...
      </div>
      <template v-else>
        <p class="text-3xl sm:text-4xl font-bold leading-none">{{ eur(total) }}</p>
        <p class="text-xs text-text-muted mt-2">
          {{ mine.length }} actif{{ mine.length > 1 ? 's' : '' }} au nom de {{ person.name }}
          <span v-if="commonTotal > 0"> · <b class="text-gold">{{ eur(commonTotal) }}</b> en commun (non compté ici)</span>
        </p>
      </template>
    </div>

    <!-- Chiffres clés -->
    <div v-if="!loading" class="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-lavender/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:layers" class="w-4 h-4 text-lavender" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none">{{ mine.length }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">Actifs à son nom</p>
        </div>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-mint/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:crown" class="w-4 h-4 text-mint" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none truncate">{{ biggest ? eur(biggest.value) : '—' }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">{{ biggest ? biggest.name : 'Plus grosse ligne' }}</p>
        </div>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4 flex items-center gap-3 col-span-2 lg:col-span-1">
        <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="lucide:users" class="w-4 h-4 text-gold" />
        </div>
        <div class="min-w-0">
          <p class="text-xl font-bold leading-none truncate">{{ eur(commonTotal) }}</p>
          <p class="text-[11px] text-text-muted truncate mt-1">En commun (à deux)</p>
        </div>
      </div>
    </div>

    <!-- Évolution du patrimoine -->
    <div v-if="!loading" class="bg-surface border border-border rounded-xl p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <h3 class="text-sm font-bold flex items-center gap-2">
          <Icon icon="lucide:line-chart" class="w-4 h-4 text-rose" />
          Évolution du patrimoine
        </h3>
        <span v-if="snapshots.length" class="text-[11px] text-text-muted flex-shrink-0">
          {{ snapshots.length }} relevé{{ snapshots.length > 1 ? 's' : '' }} mensuel{{ snapshots.length > 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Un seul point : la courbe n'a pas encore de recul, on le dit au lieu de dessiner un faux plat -->
      <div v-if="snapshots.length < 2" class="text-xs text-text-muted leading-relaxed">
        <p class="flex items-start gap-2">
          <Icon icon="lucide:info" class="w-3.5 h-3.5 mt-px flex-shrink-0 text-lavender" />
          <span>
            Le relevé du mois est enregistré automatiquement. La courbe et la projection apparaîtront
            à partir du <b>2ᵉ mois</b> — en attendant, chaque visite remet à jour le relevé du mois en cours.
          </span>
        </p>
      </div>

      <template v-else>
        <div class="flex items-baseline gap-2 flex-wrap mb-3">
          <span class="text-2xl font-bold">{{ eur(chart.last.total) }}</span>
          <span class="text-xs font-semibold flex items-center gap-1"
            :class="evolution.delta >= 0 ? 'text-mint' : 'text-rose'">
            <Icon :icon="evolution.delta >= 0 ? 'lucide:trending-up' : 'lucide:trending-down'" class="w-3.5 h-3.5" />
            {{ evolution.delta >= 0 ? '+' : '' }}{{ eur(evolution.delta) }}
            <span v-if="evolution.pct !== null">({{ evolution.pct >= 0 ? '+' : '' }}{{ evolution.pct.toFixed(1) }} %)</span>
          </span>
        </div>
        <p class="text-[11px] text-text-muted mb-3">
          sur {{ evolution.months }} mois · {{ monthLabel(snapshots[0].month) }} → {{ monthLabel(chart.last.month) }}
        </p>

        <!-- Courbe : SVG en ligne, sans librairie. preserveAspectRatio=none pour coller à la hauteur CSS,
             on ne dessine pas de points ronds (ils seraient écrasés) -->
        <svg :viewBox="`0 0 ${chart.W} ${chart.H}`" preserveAspectRatio="none" class="w-full h-28 sm:h-36">
          <defs>
            <linearGradient :id="chart.gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ff6b8a" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#ff6b8a" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="chart.area" :fill="`url(#${chart.gradientId})`" />
          <polyline :points="chart.line" fill="none" stroke="#ff6b8a" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>

        <div class="flex items-center justify-between text-[10px] text-text-muted mt-1">
          <span>{{ monthLabel(snapshots[0].month) }} · {{ eur(evolution.first) }}</span>
          <span>{{ monthLabel(chart.last.month) }} · {{ eur(evolution.last) }}</span>
        </div>

        <!-- Projection -->
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="bg-surface2 rounded-xl p-3">
            <p class="text-[11px] text-text-muted mb-1">Rythme moyen</p>
            <p class="text-sm font-bold" :class="projection && projection.perMonth >= 0 ? 'text-mint' : 'text-text'">
              {{ evolution.perMonth >= 0 ? '+' : '' }}{{ eur(evolution.perMonth) }} / mois
            </p>
          </div>
          <div class="bg-surface2 rounded-xl p-3">
            <p class="text-[11px] text-text-muted mb-1">Dans 5 ans</p>
            <p v-if="projection" class="text-sm font-bold text-lavender">{{ eur(projection.fiveYears) }}</p>
            <p v-else class="text-[11px] text-text-muted leading-tight">
              {{ snapshots.length < 3 ? 'à partir de 3 relevés' : 'tendance à la baisse' }}
            </p>
          </div>
        </div>
        <p v-if="projection" class="text-[10px] text-text-muted mt-2 flex items-start gap-1.5">
          <Icon icon="lucide:calculator" class="w-3 h-3 mt-px flex-shrink-0" />
          Projection à partir de la tendance des {{ snapshots.length }} relevés — pas une promesse.
        </p>
      </template>
    </div>

    <!-- Répartition par type -->
    <div v-if="!loading" class="bg-surface border border-border rounded-xl p-4">
      <h3 class="text-sm font-bold flex items-center gap-2 mb-3">
        <Icon icon="lucide:chart-pie" class="w-4 h-4 text-rose" />
        Répartition du patrimoine
      </h3>

      <div v-if="breakdown.length === 0" class="text-xs text-text-muted py-3">
        Aucun actif enregistré pour {{ person.name }} — ajoute-en un ci-dessous.
      </div>

      <template v-else>
        <div class="h-2.5 rounded-full overflow-hidden flex bg-surface2 mb-4">
          <div v-for="b in breakdown" :key="b.key" class="h-full transition-all duration-500"
            :style="{ width: b.pct + '%', background: b.color }" :title="b.label" />
        </div>
        <ul class="space-y-2">
          <li v-for="b in breakdown" :key="b.key" class="flex items-center gap-2.5 text-xs">
            <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="{ background: b.color }" />
            <Icon :icon="b.icon" class="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            <span class="flex-1 min-w-0 truncate">{{ b.label }} <span class="text-text-muted">({{ b.count }})</span></span>
            <span class="text-text-muted flex-shrink-0">{{ Math.round(b.pct) }} %</span>
            <span class="font-semibold flex-shrink-0 w-20 text-right">{{ eur(b.sum) }}</span>
          </li>
        </ul>
      </template>
    </div>

    <!-- Ses actifs (CRUD complet, filtré sur la personne) -->
    <BusinessAssets ref="assetsRef" :owner="personId" heading="Ses actifs" />
  </div>
</template>
