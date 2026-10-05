<script setup lang="ts">
definePageMeta({ layout: 'default' })

useHead({ title: 'Business — Nous Deux' })

const route = useRoute()
const router = useRouter()

type Tab = 'agenda' | 'ideas'
const tabs = [
  { key: 'agenda' as Tab, label: 'Agenda', icon: 'lucide:calendar-clock', cta: 'Nouveau rendez-vous', short: 'Ajouter' },
  { key: 'ideas' as Tab, label: 'Idées', icon: 'lucide:lightbulb', cta: 'Nouvelle idée', short: 'Ajouter' },
]

// L'onglet vit dans l'URL : partageable, conservé au rechargement
const tab = ref<Tab>(route.query.tab === 'ideas' ? 'ideas' : 'agenda')
const agendaRef = ref<any>(null)
const ideasRef = ref<any>(null)
const active = computed(() => tabs.find(t => t.key === tab.value) || tabs[0])

function selectTab(key: Tab) {
  tab.value = key
  router.replace({ query: key === 'agenda' ? {} : { tab: key } })
}

// Une seule action principale, qui suit l'onglet actif
function primaryAction() {
  if (tab.value === 'agenda') agendaRef.value?.openCreate()
  else ideasRef.value?.openCreate()
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <Icon icon="lucide:briefcase" class="w-7 h-7 text-rose" />
        Business
      </h1>
      <p class="text-text-muted text-sm mt-1">Tes rendez-vous pro et tes idées — visibles par {{ 'Amandine' }} et toi</p>
    </div>

    <!-- Sections Business + action principale -->
    <div class="flex items-center justify-between gap-3 mb-6">
      <div class="bg-surface border border-border rounded-xl p-1 flex gap-1 flex-shrink-0">
        <button v-for="t in tabs" :key="t.key" @click="selectTab(t.key)"
          class="px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
          :class="tab === t.key ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text'">
          <Icon :icon="t.icon" class="w-4 h-4" /> {{ t.label }}
        </button>
      </div>
      <button @click="primaryAction"
        class="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-rose to-lavender rounded-xl text-white font-semibold text-sm hover:scale-105 transition-transform duration-300 shadow-lg shadow-rose/20 flex items-center gap-2 flex-shrink-0">
        <Icon icon="lucide:plus" class="w-4 h-4" />
        <span class="hidden sm:inline">{{ active.cta }}</span><span class="sm:hidden">{{ active.short }}</span>
      </button>
    </div>

    <BusinessAgenda v-if="tab === 'agenda'" ref="agendaRef" />
    <BusinessIdeas v-else ref="ideasRef" />
  </div>
</template>
