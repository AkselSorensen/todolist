<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }]
})

const { account } = useAuth()
const myName = computed(() => account.value?.name || 'Moi')
const partnerName = computed(() => account.value?.partner?.name || 'Partenaire')
const myColor = computed(() => account.value?.color || '#4da6ff')
const partnerColor = computed(() => account.value?.partner?.color || '#ff6b8a')
const myId = computed(() => account.value?.id)
const partnerId = computed(() => account.value?.partner?.id)

const allPlaces = ref<any[]>([])
const visited = ref<any[]>([]) // { country_name, visited_by }

async function loadCountries() { try { allPlaces.value = await $fetch('/api/countries') } catch { allPlaces.value = [] } }
async function loadVisited() { try { visited.value = await $fetch('/api/visited') } catch { visited.value = [] } }

function getVisitedBy(name: string) { return visited.value.find((v: any) => v.country_name === name)?.visited_by || null }
function isVisited(name: string) { return !!getVisitedBy(name) }
function isWishlist(name: string) { return getVisitedBy(name) === 'wishlist' }

// Scores
const scoreMoi = computed(() => visited.value.filter((v: any) => v.visited_by === String(myId.value)).length)
const scorePartenaire = computed(() => visited.value.filter((v: any) => v.visited_by === String(partnerId.value)).length)
const scoreBoth = computed(() => visited.value.filter((v: any) => v.visited_by === 'both').length)
const scoreWishlist = computed(() => visited.value.filter((v: any) => v.visited_by === 'wishlist').length)
function getVisitedColor(name: string) {
  const by = getVisitedBy(name)
  if (by === String(myId.value)) return myColor.value
  if (by === String(partnerId.value)) return partnerColor.value
  if (by === 'both') return '#F5A623'
  if (by === 'wishlist') return '#a78bfa'
  return null
}
function getVisitedEmoji(name: string) {
  const by = getVisitedBy(name)
  if (by === String(myId.value)) return '🧑'
  if (by === String(partnerId.value)) return '👩'
  if (by === 'both') return '💞'
  if (by === 'wishlist') return '💭'
  return null
}

const search = ref('')
const continentFilter = ref('')
const continents = computed(() => ['', ...new Set(allPlaces.value.map((p: any) => p.continent))])
const filteredPlaces = computed(() => allPlaces.value.filter((p: any) => {
  const ms = !search.value || p.name.toLowerCase().includes(search.value.toLowerCase()) || p.continent.toLowerCase().includes(search.value.toLowerCase())
  const mc = !continentFilter.value || p.continent === continentFilter.value
  return ms && mc
}))

// Modal
const showModal = ref(false)
const selectedCountry = ref<any>(null)

function openCountryModal(p: any) {
  selectedCountry.value = p
  showModal.value = true
}

async function saveVisit(countryName: string, visitedBy: string | null) {
  try {
    const res = await $fetch('/api/visited', { method: 'POST', body: { country: countryName, visited_by: visitedBy } })
    if (res.visited) {
      const idx = visited.value.findIndex((v: any) => v.country_name === countryName)
      if (idx >= 0) visited.value[idx] = { country_name: countryName, visited_by: res.visited_by }
      else visited.value.push({ country_name: countryName, visited_by: res.visited_by })
    } else {
      visited.value = visited.value.filter((v: any) => v.country_name !== countryName)
    }
    showModal.value = false
    updateGeoJSON()
    updateMarkers()
  } catch {}
}

const visitedByLabel: Record<string, string> = { [String(myId.value)]: `🧑 ${myName.value}`, [String(partnerId.value)]: `👩 ${partnerName.value}`, both: '💞 Les deux' }

// Map
const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: any = null, markersLayer: any = null, geoJsonLayer: any = null, LeafletModule: any = null, geoJsonData: any = null

onMounted(async () => {
  await loadCountries()
  await loadVisited()
  await nextTick()
  await new Promise(r => setTimeout(r, 200))

  try {
    const resp = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    geoJsonData = await resp.json()
  } catch {}

  LeafletModule = await import('leaflet')
  const L = LeafletModule.default

  if (mapContainer.value) {
    mapInstance = L.map(mapContainer.value, { center: [25, 0], zoom: 2, zoomControl: true, attributionControl: false, scrollWheelZoom: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(mapInstance)
    markersLayer = L.layerGroup().addTo(mapInstance)

    if (geoJsonData) {
      geoJsonLayer = L.geoJSON(geoJsonData, {
        style: { fillOpacity: 0, color: 'transparent', weight: 0 },
        onEachFeature: (feature: any, layer: any) => {
          layer.on('click', () => {
            const enName = feature?.properties?.name
            const place = allPlaces.value.find((p: any) => p.en === enName)
            if (place) {
              mapInstance?.flyTo([place.lat, place.lng], 5, { duration: 0.8 })
              openCountryModal(place)
            }
          })
        },
      }).addTo(mapInstance)
      updateGeoJSON()
    }

    updateMarkers()
    setTimeout(() => mapInstance?.invalidateSize(), 300)
    gsap.fromTo('.place-card', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out', delay: 0.3 })
  }
})

function updateGeoJSON() {
  if (!geoJsonLayer) return
  geoJsonLayer.setStyle((feature: any) => {
    const enName = feature?.properties?.name
    const place = allPlaces.value.find((p: any) => p.en === enName)
    if (!place) return { fillOpacity: 0, color: 'transparent', weight: 0 }
    const color = getVisitedColor(place.name)
    return color
      ? { fillColor: color, fillOpacity: 0.35, color, weight: 1.5, opacity: 0.8 }
      : { fillOpacity: 0, color: 'transparent', weight: 0 }
  })
}

function updateMarkers() {
  if (!markersLayer || !mapInstance || !LeafletModule) return
  const L = LeafletModule.default
  markersLayer.clearLayers()
  filteredPlaces.value.forEach((p: any) => {
    const v = isVisited(p.name)
    const html = `<div style="font-size:16px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">${p.emoji}</div>`
    const icon = L.divIcon({ html, className: 'custom-marker', iconSize: [28, 28], iconAnchor: [14, 14] })
    const marker = L.marker([p.lat, p.lng], { icon, opacity: v ? 1 : 0.35 }).addTo(markersLayer)
    marker.on('click', () => openCountryModal(p))
  })
}

function flyToPlace(p: any) { mapInstance?.flyTo([p.lat, p.lng], 5, { duration: 0.8 }); openCountryModal(p) }

// Wishlist panel
const showWishlist = ref(true)
const wishlistCountries = computed(() => allPlaces.value.filter((p: any) => getVisitedBy(p.name) === 'wishlist'))
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="text-center mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:globe" class="w-6 sm:w-7 h-6 sm:h-7 text-gold" /> Notre Carte
      </h1>
      <p class="text-text-muted text-sm">{{ visited.length }} pays visités · {{ allPlaces.length - visited.length }} à découvrir</p>
      <div class="flex items-center justify-center gap-4 mt-2">
        <span class="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">🧑 {{ myName }}: {{ scoreMoi }}</span>
        <span class="text-xs px-3 py-1 rounded-full bg-rose-500/10 text-rose border border-rose-500/20">👩 {{ partnerName }}: {{ scorePartenaire }}</span>
        <span class="text-xs px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">💞 Ensemble: {{ scoreBoth }}</span>
        <span class="text-xs px-3 py-1 rounded-full bg-lavender/10 text-lavender border border-lavender/20">💭 Rêves: {{ scoreWishlist }}</span>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <div class="flex-1 relative">
        <Icon icon="lucide:search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input v-model="search" type="text" placeholder="Rechercher un pays..."
          class="w-full bg-surface2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
      </div>
      <div class="flex gap-2 overflow-x-auto">
        <button v-for="c in continents" :key="c" @click="continentFilter = c"
          class="px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
          :class="continentFilter === c ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-surface border border-border text-text-muted hover:text-text'">
          {{ c || '🌍 Tous' }}
        </button>
      </div>
    </div>

    <div ref="mapContainer" class="w-full h-[350px] sm:h-[450px] rounded-2xl border border-border overflow-hidden mb-6" />

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      <div v-for="p in filteredPlaces" :key="p.name"
        class="place-card bg-surface border rounded-xl p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] group flex items-center gap-3"
        :class="isVisited(p.name) ? 'border-gold/30 bg-gold/5' : 'border-border hover:border-lavender/30'"
        @click="flyToPlace(p)">
        <span class="text-xl flex-shrink-0" :class="isVisited(p.name) ? '' : 'opacity-40 grayscale'">{{ p.emoji }}</span>
        <span class="text-sm font-medium text-text truncate flex-1">{{ p.name }}</span>
        <span v-if="getVisitedEmoji(p.name)" class="text-xs flex-shrink-0">{{ getVisitedEmoji(p.name) }}</span>
      </div>
    </div>
    <p v-if="filteredPlaces.length === 0" class="text-center py-8 text-text-muted">Aucun pays trouvé</p>

    <!-- Wishlist Side Panel -->
    <Transition name="slide">
      <div v-if="showWishlist && wishlistCountries.length > 0" class="fixed right-4 top-24 z-40 w-64 max-h-[70vh] bg-surface border border-lavender/30 rounded-2xl shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-border bg-lavender/5">
          <p class="text-sm font-bold flex items-center gap-2"><Icon icon="lucide:sparkles" class="w-4 h-4 text-lavender" /> 💭 Wishlist</p>
          <button @click="showWishlist = false" class="text-text-muted hover:text-text transition-colors">
            <Icon icon="lucide:x" class="w-4 h-4" />
          </button>
        </div>
        <div class="overflow-y-auto max-h-[calc(70vh-56px)] p-2 space-y-1">
          <div v-for="p in wishlistCountries" :key="p.name"
            @click="flyToPlace(p)"
            class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-surface2 transition-colors text-sm">
            <span>{{ p.emoji }}</span>
            <span class="text-text truncate flex-1">{{ p.name }}</span>
            <button @click.stop="saveVisit(p.name, null)" class="text-text-muted hover:text-rose text-xs">✕</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Wishlist toggle -->
    <button v-if="!showWishlist && wishlistCountries.length > 0" @click="showWishlist = true"
      class="fixed right-4 top-24 z-40 w-12 h-12 rounded-full bg-lavender/20 border border-lavender/30 text-lavender flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
      <Icon icon="lucide:sparkles" class="w-5 h-5" />
      <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-lavender text-white text-[10px] font-bold flex items-center justify-center">{{ wishlistCountries.length }}</span>
    </button>

    <!-- Country Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal && selectedCountry" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
          <div class="relative bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <button @click="showModal = false" class="absolute top-4 right-4 text-text-muted hover:text-text transition-colors">
              <Icon icon="lucide:x" class="w-5 h-5" />
            </button>

            <div class="text-center mb-4">
              <span class="text-5xl block mb-2">{{ selectedCountry.emoji }}</span>
              <h2 class="text-xl font-bold">{{ selectedCountry.name }}</h2>
              <p class="text-sm text-text-muted">{{ selectedCountry.continent }}</p>
            </div>

            <!-- Attractions -->
            <div v-if="selectedCountry.attractions" class="mb-5 p-4 bg-surface2 rounded-xl">
              <p class="text-xs font-semibold text-text-muted uppercase mb-2 flex items-center gap-1">
                <Icon icon="lucide:map-pin" class="w-3 h-3" /> À visiter
              </p>
              <p class="text-sm text-text leading-relaxed">{{ selectedCountry.attractions }}</p>
            </div>

            <!-- Visited by -->
            <div class="mb-5">
              <p class="text-xs font-semibold text-text-muted uppercase mb-2">Qui a visité ?</p>
              <div class="grid grid-cols-3 gap-2">
                <button @click="saveVisit(selectedCountry.name, String(myId))"
                  class="py-3 rounded-xl text-sm font-medium transition-all border"
                  :class="getVisitedBy(selectedCountry.name) === String(myId) ? 'bg-rose/15 border-rose/30 text-rose' : 'border-border text-text-muted hover:border-rose/30 hover:text-rose'">
                  🧑 {{ myName }}
                </button>
                <button @click="saveVisit(selectedCountry.name, String(partnerId))"
                  class="py-3 rounded-xl text-sm font-medium transition-all border"
                  :class="getVisitedBy(selectedCountry.name) === String(partnerId) ? 'bg-lavender/15 border-lavender/30 text-lavender' : 'border-border text-text-muted hover:border-lavender/30 hover:text-lavender'">
                  👩 {{ partnerName }}
                </button>
                <button @click="saveVisit(selectedCountry.name, 'both')"
                  class="py-3 rounded-xl text-sm font-medium transition-all border"
                  :class="getVisitedBy(selectedCountry.name) === 'both' ? 'bg-gold/15 border-gold/30 text-gold' : 'border-border text-text-muted hover:border-gold/30 hover:text-gold'">
                  💞 Les deux
                </button>
              </div>
            </div>

            <!-- Wishlist -->
            <div class="mb-5">
              <button @click="saveVisit(selectedCountry.name, 'wishlist')"
                class="w-full py-3 rounded-xl text-sm font-medium transition-all border"
                :class="isWishlist(selectedCountry.name) ? 'bg-lavender/15 border-lavender/30 text-lavender' : 'border-dashed border-border text-text-muted hover:border-lavender/30 hover:text-lavender'">
                💭 À faire ensemble
              </button>
            </div>

            <!-- Remove -->
            <button v-if="isVisited(selectedCountry.name)" @click="saveVisit(selectedCountry.name, null)"
              class="w-full py-2.5 rounded-xl border border-rose/30 text-rose text-sm hover:bg-rose/10 transition-colors flex items-center justify-center gap-2">
              <Icon icon="lucide:trash-2" class="w-4 h-4" /> Retirer des visités
            </button>
            <p v-else class="text-center text-sm text-text-muted">Sélectionne qui a visité ce pays 👆</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
.leaflet-container { background: #1a1a24; z-index: 1; }
.leaflet-popup-content-wrapper { background: #1a1a24 !important; color: #e8e8f0 !important; border: 1px solid #2a2a3e !important; border-radius: 12px !important; }
.leaflet-popup-tip { background: #1a1a24 !important; }
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
.slide-enter-active, .slide-leave-active { transition: all 0.3s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(20px); }
</style>
