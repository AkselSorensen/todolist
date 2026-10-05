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
  loading.value = false
}

onMounted(load)
watch(() => props.personId, load)

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0)

const total = computed(() => mine.value.reduce((s, a) => s + (Number(a.value) || 0), 0))
const commonTotal = computed(() => common.value.reduce((s, a) => s + (Number(a.value) || 0), 0))
const biggest = computed(() => mine.value.slice().sort((a, b) => b.value - a.value)[0] || null)

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
