<script setup lang="ts">
// Page de présentation : le bilan projetable, diapositive par diapositive, et
// l'export PowerPoint (.pptx) généré depuis exactement la même liste de slides.
import { buildDeck } from '~/utils/presentationDeck'
import { downloadPptx } from '~/utils/pptxExport'

const route = useRoute()
const api = useApi()

const months = computed(() => Math.min(24, Math.max(1, Number(route.query.months) || 6)))
const report = ref<any>(null)
const deck = ref<any>(null)
const loading = ref(true)
const errorMsg = ref('')
const exporting = ref(false)
const exportMsg = ref('')

const idx = ref(0)
const slides = computed<any[]>(() => deck.value?.slides || [])
const current = computed<any>(() => slides.value[idx.value] || null)

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))

const SEV: Record<string, { border: string; text: string; label: string }> = {
  alert: { border: 'border-rose/40', text: 'text-rose', label: 'À corriger' },
  warn: { border: 'border-gold/40', text: 'text-gold', label: 'Vigilance' },
  info: { border: 'border-lavender/40', text: 'text-lavender', label: 'À savoir' },
  ok: { border: 'border-mint/40', text: 'text-mint', label: 'Bon point' },
}
const sev = (s: string) => SEV[s] || SEV.info

async function load() {
  loading.value = true
  try {
    const r = await api.fetchExpenseReport(months.value)
    report.value = r
    deck.value = buildDeck(r)
    idx.value = 0
    errorMsg.value = ''
  } catch (err: any) {
    errorMsg.value = 'Impossible de charger le bilan : ' + (err?.data?.message || 'réessaie.')
  }
  loading.value = false
}

onMounted(load)
watch(months, load)

const go = (d: number) => { idx.value = Math.min(slides.value.length - 1, Math.max(0, idx.value + d)) }

function onKey(e: KeyboardEvent) {
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { go(1); e.preventDefault() }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { go(-1); e.preventDefault() }
  if (e.key === 'Home') idx.value = 0
  if (e.key === 'End') idx.value = slides.value.length - 1
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function download() {
  if (exporting.value || !deck.value) return
  exporting.value = true
  exportMsg.value = 'Génération du .pptx...'
  try {
    // import à la demande : pptxgenjs ne pèse que si on exporte
    const name = await downloadPptx(deck.value)
    exportMsg.value = `Téléchargé : ${name}`
  } catch (err: any) {
    exportMsg.value = 'Export impossible : ' + (err?.message || err)
  } finally {
    exporting.value = false
  }
}

/* ------- géométrie des mini-graphiques (SVG/HTML, sans librairie) ------- */
const barChart = (s: any) => {
  const max = Math.max(1, ...(s.values || []).flat().map((v: number) => Number(v) || 0))
  const n = (s.categories || []).length
  const w = 100 / Math.max(1, n)
  return (s.categories || []).map((c: string, i: number) => {
    let acc = 0
    const segs = (s.values || []).map((serie: number[], si: number) => {
      const v = Number(serie[i]) || 0
      const seg = { h: (v / max) * 100, color: s.series?.[si]?.color || '#8888a0', name: s.series?.[si]?.name }
      acc += v
      return seg
    }).filter((x: any) => x.h > 0)
    return { label: c, segs, total: acc, w }
  })
}

const pieTotal = computed(() => (current.value?.values?.[0] || []).reduce((a: number, b: number) => a + (Number(b) || 0), 0))
</script>

<template>
  <div class="max-w-5xl mx-auto px-3 sm:px-4 py-6">
    <!-- Barre d'outils -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <NuxtLink to="/business-date?tab=expenses"
        class="px-3 py-2 rounded-xl border border-border bg-surface text-text-muted text-xs font-medium hover:text-text transition-colors flex items-center gap-1.5">
        <Icon icon="lucide:arrow-left" class="w-3.5 h-3.5" /> Bilan
      </NuxtLink>
      <div class="bg-surface border border-border rounded-xl p-1 flex gap-1">
        <NuxtLink v-for="m in [3, 6, 12]" :key="m" :to="`/business-presentation?months=${m}`"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="months === m ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text'">
          {{ m }} mois
        </NuxtLink>
      </div>

      <div class="flex-1" />

      <div class="flex items-center gap-2">
        <button @click="go(-1)" :disabled="idx === 0"
          class="p-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text transition-colors disabled:opacity-40" aria-label="Précédent">
          <Icon icon="lucide:chevron-left" class="w-4 h-4" />
        </button>
        <span class="text-xs text-text-muted tabular-nums w-14 text-center">{{ idx + 1 }} / {{ slides.length || 0 }}</span>
        <button @click="go(1)" :disabled="idx >= slides.length - 1"
          class="p-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text transition-colors disabled:opacity-40" aria-label="Suivant">
          <Icon icon="lucide:chevron-right" class="w-4 h-4" />
        </button>
      </div>

      <button @click="download" :disabled="exporting || !deck"
        class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-xs hover:scale-[1.02] transition-transform flex items-center gap-2 disabled:opacity-60 flex-shrink-0">
        <Icon :icon="exporting ? 'lucide:loader-circle' : 'lucide:presentation'" class="w-4 h-4" :class="{ 'animate-spin': exporting }" />
        Télécharger le PowerPoint
      </button>
    </div>

    <p v-if="exportMsg" class="text-xs text-text-muted mb-3">{{ exportMsg }}</p>
    <p v-if="errorMsg" class="text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2 mb-3">{{ errorMsg }}</p>

    <div v-if="loading" class="text-center py-16 text-text-muted text-sm">
      <Icon icon="lucide:loader-circle" class="w-7 h-7 mx-auto animate-spin mb-2" /> Préparation de la présentation...
    </div>

    <!-- Diapositive courante : ratio 16/9, pensé pour la projection -->
    <div v-else-if="current" class="bg-surface border border-border rounded-2xl overflow-hidden">
      <div class="relative w-full aspect-[16/9] p-5 sm:p-8 flex flex-col">
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose via-gold to-lavender" />

        <!-- Titre -->
        <template v-if="current.kind === 'title'">
          <div class="m-auto text-center max-w-2xl">
            <h1 class="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-rose via-gold to-lavender bg-clip-text text-transparent">{{ current.title }}</h1>
            <p class="text-rose text-sm sm:text-lg mt-4">{{ current.subtitle }}</p>
            <p class="text-text-muted text-xs sm:text-sm mt-2">{{ current.meta }}</p>
          </div>
        </template>

        <!-- KPIs -->
        <template v-else-if="current.kind === 'kpis'">
          <h2 class="text-lg sm:text-2xl font-bold mb-4">{{ current.title }}</h2>
          <div class="grid grid-cols-2 gap-3 sm:gap-4 flex-1">
            <div v-for="it in current.items" :key="it.label" class="rounded-xl border border-border bg-surface2/40 p-3 sm:p-4 flex flex-col justify-center relative overflow-hidden">
              <div class="absolute left-0 top-0 bottom-0 w-1" :style="{ background: it.color }" />
              <p class="text-[10px] sm:text-xs uppercase tracking-wide text-text-muted font-semibold">{{ it.label }}</p>
              <p class="text-xl sm:text-3xl font-bold leading-tight mt-1" :style="{ color: it.color }">{{ it.value }}</p>
              <p v-if="it.sub" class="text-[10px] sm:text-xs text-text-muted mt-1">{{ it.sub }}</p>
            </div>
          </div>
        </template>

        <!-- Score -->
        <template v-else-if="current.kind === 'score'">
          <h2 class="text-lg sm:text-2xl font-bold">{{ current.title }}</h2>
          <div class="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center flex-1">
            <div class="text-center flex-shrink-0">
              <p class="text-4xl sm:text-6xl font-black leading-none"
                :class="current.total / current.max >= 0.8 ? 'text-mint' : current.total / current.max >= 0.5 ? 'text-gold' : 'text-rose'">
                {{ Math.round(current.total) }}
              </p>
              <p class="text-text-muted text-xs sm:text-sm">/ {{ current.max }} — {{ current.label }}</p>
            </div>
            <div class="flex-1 w-full space-y-2">
              <div v-for="d in current.dimensions" :key="d.label">
                <div class="flex items-baseline justify-between text-[11px] sm:text-xs mb-1">
                  <span class="font-medium">{{ d.label }}</span>
                  <span class="text-text-muted">{{ d.points }}/{{ d.max }}</span>
                </div>
                <div class="h-1.5 rounded-full bg-surface2 overflow-hidden">
                  <div class="h-full rounded-full" :style="{ width: Math.max(3, (d.points / d.max) * 100) + '%', background: d.color }" />
                </div>
              </div>
            </div>
          </div>
          <div class="hidden sm:block mt-3 space-y-0.5">
            <p v-for="d in current.dimensions" :key="d.label" class="text-[10px] text-text-muted truncate">• {{ d.detail }}</p>
          </div>
        </template>

        <!-- Barres empilées -->
        <template v-else-if="current.kind === 'chart' && current.chart === 'bar'">
          <h2 class="text-lg sm:text-2xl font-bold">{{ current.title }}</h2>
          <p class="text-[10px] sm:text-xs text-text-muted mb-3">{{ current.subtitle }}</p>
          <div class="flex items-end gap-2 sm:gap-4 flex-1 min-h-0">
            <div v-for="b in barChart(current)" :key="b.label" class="flex-1 flex flex-col items-center justify-end h-full min-w-0">
              <span class="text-[9px] sm:text-[11px] text-text-muted mb-1">{{ b.total > 0 ? eur(b.total) : '' }}</span>
              <div class="w-full max-w-[70px] flex flex-col justify-end rounded-t-md overflow-hidden" :style="{ height: '72%' }">
                <div v-for="(s2, si) in b.segs" :key="si" :style="{ height: s2.h + '%', background: s2.color }" />
              </div>
              <span class="text-[9px] sm:text-[11px] text-text-muted mt-1">{{ b.label }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-3 mt-3 pt-2 border-t border-border">
            <span v-for="se in current.series" :key="se.name" class="flex items-center gap-1.5 text-[10px] sm:text-xs text-text-muted">
              <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: se.color }" /> {{ se.name }}
            </span>
          </div>
          <p v-if="current.footer" class="text-[9px] sm:text-[11px] text-text-muted mt-1 truncate">{{ current.footer }}</p>
        </template>

        <!-- Répartition -->
        <template v-else-if="current.kind === 'chart' && current.chart === 'pie'">
          <h2 class="text-lg sm:text-2xl font-bold">{{ current.title }}</h2>
          <p class="text-[10px] sm:text-xs text-text-muted mb-3">{{ current.subtitle }}</p>
          <div class="h-3 rounded-full overflow-hidden flex bg-surface2 mb-4">
            <div v-for="(v, i) in current.values[0]" :key="i" class="h-full"
              :style="{ width: pieTotal > 0 ? (v / pieTotal) * 100 + '%' : '0%', background: current.colors[i % current.colors.length] }" />
          </div>
          <ul class="space-y-1.5 flex-1 overflow-hidden">
            <li v-for="(c, i) in current.categories" :key="c" class="flex items-center gap-2 text-[11px] sm:text-sm">
              <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="{ background: current.colors[i % current.colors.length] }" />
              <span class="flex-1 min-w-0 truncate">{{ c }}</span>
              <span class="text-text-muted flex-shrink-0">{{ pieTotal > 0 ? Math.round((current.values[0][i] / pieTotal) * 100) : 0 }} %</span>
              <span class="font-semibold flex-shrink-0 w-24 text-right">{{ eur(current.values[0][i]) }}</span>
            </li>
          </ul>
        </template>

        <!-- Repère 50/30/20 -->
        <template v-else-if="current.kind === 'chart' && current.chart === 'rule'">
          <h2 class="text-lg sm:text-2xl font-bold">{{ current.title }}</h2>
          <p class="text-[10px] sm:text-xs text-text-muted mb-4">{{ current.subtitle }}</p>
          <div class="space-y-6 flex-1">
            <div v-for="r in current.rows" :key="r.label">
              <div class="flex items-baseline justify-between text-xs sm:text-sm mb-2">
                <span class="font-semibold flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: r.color }" /> {{ r.label }}
                </span>
                <span>
                  <b :style="{ color: r.color }">{{ eur(r.real) }}</b>
                  <span class="text-text-muted"> / objectif {{ eur(r.target) }}</span>
                </span>
              </div>
              <div class="relative h-3 rounded-full bg-surface2 overflow-hidden">
                <div class="h-full rounded-full" :style="{ width: Math.min(100, r.target > 0 ? (r.real / (r.target * 1.6)) * 100 : 0) + '%', background: r.color }" />
                <div class="absolute top-0 bottom-0 w-0.5 bg-text/70" :style="{ left: (1 / 1.6) * 100 + '%' }" />
              </div>
            </div>
          </div>
        </template>

        <!-- Qui déclare quoi -->
        <template v-else-if="current.kind === 'chart' && current.chart === 'people'">
          <h2 class="text-lg sm:text-2xl font-bold">{{ current.title }}</h2>
          <p class="text-[10px] sm:text-xs text-text-muted mb-4">{{ current.subtitle }}</p>
          <div class="grid gap-3 flex-1" :class="current.rows.length > 1 ? 'sm:grid-cols-2' : ''">
            <div v-for="row in current.rows" :key="row.label" class="rounded-xl border border-border bg-surface2/40 p-4">
              <p class="text-sm font-bold mb-3 flex items-center gap-2">
                <span class="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" :style="{ background: row.color }">{{ row.label.charAt(0) }}</span>
                {{ row.label }}
              </p>
              <div class="space-y-2">
                <div v-for="v in row.values" :key="v.label" class="flex items-center justify-between text-xs">
                  <span class="text-text-muted">{{ v.label }}</span>
                  <b>{{ eur(v.value) }}</b>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Conseil -->
        <template v-else-if="current.kind === 'advice'">
          <div class="flex items-center justify-between">
            <h2 class="text-sm sm:text-base font-bold text-text-muted uppercase tracking-wide">Conseils</h2>
            <span class="text-[10px] sm:text-xs text-text-muted">{{ current.step }}</span>
          </div>
          <div class="m-auto w-full max-w-3xl rounded-2xl border p-5 sm:p-7" :class="[sev(current.severity).border, 'bg-surface2/40']">
            <p class="text-[10px] sm:text-xs font-bold tracking-widest mb-2" :class="sev(current.severity).text">{{ sev(current.severity).label.toUpperCase() }}</p>
            <p class="text-lg sm:text-2xl font-bold mb-3">{{ current.title }}</p>
            <p class="text-xs sm:text-base text-text-muted leading-relaxed">{{ current.text }}</p>
          </div>
        </template>

        <!-- Tableau -->
        <template v-else-if="current.kind === 'table'">
          <h2 class="text-lg sm:text-2xl font-bold">{{ current.title }}</h2>
          <p class="text-[10px] sm:text-xs text-text-muted mb-3">{{ current.subtitle }}</p>
          <div class="flex-1 min-h-0 overflow-hidden">
            <table class="w-full text-[11px] sm:text-sm">
              <thead>
                <tr class="text-text-muted text-left">
                  <th v-for="h in current.head" :key="h" class="pb-2 font-medium">{{ h }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in current.rows.slice(0, 9)" :key="i" class="border-t border-border/60">
                  <td v-for="(cell, ci) in row" :key="ci" class="py-1.5"
                    :class="[ci === row.length - 1 ? 'font-semibold text-right' : (ci === 0 ? '' : 'text-text-muted')]">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="current.rows.length > 9" class="text-[10px] text-text-muted mt-2">+ {{ current.rows.length - 9 }} autres lignes (dans le fichier PowerPoint)</p>
          </div>
        </template>

        <!-- Méthode -->
        <template v-else>
          <h2 class="text-lg sm:text-2xl font-bold mb-4">{{ current.title }}</h2>
          <p class="text-xs sm:text-base text-text-muted leading-relaxed max-w-3xl">{{ current.text }}</p>
        </template>
      </div>
    </div>

    <!-- Vignettes -->
    <div v-if="!loading && slides.length" class="flex gap-1.5 mt-4 overflow-x-auto pb-1">
      <button v-for="(s, i) in slides" :key="i" @click="idx = i"
        class="px-2.5 py-1.5 rounded-lg border text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0"
        :class="i === idx ? 'bg-surface2 border-rose/40 text-text' : 'bg-surface/60 border-border text-text-muted hover:text-text'">
        {{ i + 1 }}. {{ s.title }}
      </button>
    </div>

    <p class="text-[11px] text-text-muted mt-3 flex items-start gap-1.5">
      <Icon icon="lucide:info" class="w-3.5 h-3.5 mt-px flex-shrink-0 text-lavender" />
      <span>Flèches ← → ou espace pour naviguer. Le bouton « Télécharger le PowerPoint » génère un vrai
        fichier .pptx (mêmes chiffres, graphiques natifs PowerPoint) à partir de ce bilan.</span>
    </p>
  </div>
</template>
