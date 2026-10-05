<script setup lang="ts">
definePageMeta({ layout: 'default' })

useHead({ title: 'Business — Nous Deux' })

const route = useRoute()
const router = useRouter()

type Tab = 'agenda' | 'company' | 'investment' | 'aksel' | 'amandine' | 'goals'
const tabs = [
  { key: 'agenda' as Tab, label: 'Agenda', icon: 'lucide:calendar-clock', cta: 'Nouveau rendez-vous' },
  { key: 'company' as Tab, label: 'Entreprise', icon: 'lucide:briefcase', cta: 'Nouvelle idée' },
  { key: 'investment' as Tab, label: 'Investissement', icon: 'lucide:trending-up', cta: 'Nouvelle piste' },
  { key: 'aksel' as Tab, label: 'Aksel', icon: 'lucide:user', person: 4, color: '#4da6ff', cta: 'Ajouter un actif' },
  { key: 'amandine' as Tab, label: 'Amandine', icon: 'lucide:user', person: 5, color: '#ff6b8a', cta: 'Ajouter un actif' },
  { key: 'goals' as Tab, label: 'Objectifs', icon: 'lucide:target', cta: 'Nouvel objectif' },
]

// L'onglet vit dans l'URL : partageable, conserve au rechargement
const known = tabs.map(t => t.key)
const requested = String(route.query.tab || '') as Tab
const tab = ref<Tab>(known.includes(requested) ? requested : 'agenda')

const agendaRef = ref<any>(null)
const companyRef = ref<any>(null)
const investmentRef = ref<any>(null)
const akselRef = ref<any>(null)
const amandineRef = ref<any>(null)
const goalsRef = ref<any>(null)
const stripRef = ref<HTMLElement | null>(null)
const tabEls: Record<string, HTMLElement | null> = {}

const active = computed(() => tabs.find(t => t.key === tab.value) || tabs[0])

function setTabEl(key: string, el: any) {
  tabEls[key] = el as HTMLElement | null
}

function selectTab(key: Tab) {
  tab.value = key
  router.replace({ query: key === 'agenda' ? {} : { tab: key } })
  // La barre peut défiler (6 onglets en mobile) : on recentre l'onglet choisi
  nextTick(() => {
    const el = tabEls[key]
    const strip = stripRef.value
    if (!el || !strip) return
    strip.scrollTo({ left: Math.max(0, el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2), behavior: 'smooth' })
  })
}

// Une seule action principale, qui suit l'onglet actif
function primaryAction() {
  const refs: Record<Tab, any> = {
    agenda: agendaRef, company: companyRef, investment: investmentRef,
    aksel: akselRef, amandine: amandineRef, goals: goalsRef,
  }
  refs[tab.value]?.value?.openCreate()
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <Icon icon="lucide:briefcase" class="w-7 h-7 text-rose" />
        Business
      </h1>
      <p class="text-text-muted text-sm mt-1">Rendez-vous pro, idées de boîte, placements, patrimoine et objectifs</p>
    </div>

    <!-- Sections Business + action principale -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div ref="stripRef" class="bg-surface border border-border rounded-xl p-1 flex gap-1 overflow-x-auto min-w-0">
        <button v-for="t in tabs" :key="t.key" :ref="el => setTabEl(t.key, el)" @click="selectTab(t.key)"
          class="px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap"
          :class="tab === t.key ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text'">
          <span v-if="t.person" class="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            :style="{ background: t.color }">{{ t.label.charAt(0) }}</span>
          <Icon v-else :icon="t.icon" class="w-4 h-4 max-[360px]:hidden" />
          {{ t.label }}
        </button>
      </div>
      <button @click="primaryAction"
        class="w-full sm:w-auto justify-center px-4 sm:px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm hover:scale-105 transition-transform duration-300 shadow-lg shadow-rose/20 flex items-center gap-2 flex-shrink-0">
        <Icon icon="lucide:plus" class="w-4 h-4" /> {{ active.cta }}
      </button>
    </div>

    <BusinessAgenda v-if="tab === 'agenda'" ref="agendaRef" />
    <BusinessIdeas v-else-if="tab === 'company'" ref="companyRef" domain="company" />
    <BusinessInvestments v-else-if="tab === 'investment'" ref="investmentRef" />
    <BusinessPatrimoine v-else-if="tab === 'aksel'" ref="akselRef" :person-id="4" />
    <BusinessPatrimoine v-else-if="tab === 'amandine'" ref="amandineRef" :person-id="5" />
    <BusinessGoals v-else ref="goalsRef" />
  </div>
</template>
