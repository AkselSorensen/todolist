<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }]
})

const allPlaces = [
  { name: 'France', lat: 46.603354, lng: 1.888334, continent: 'Europe', emoji: '🇫🇷' },
  { name: 'Italie', lat: 41.87194, lng: 12.56738, continent: 'Europe', emoji: '🇮🇹' },
  { name: 'Espagne', lat: 40.463667, lng: -3.74922, continent: 'Europe', emoji: '🇪🇸' },
  { name: 'Portugal', lat: 39.399872, lng: -8.224454, continent: 'Europe', emoji: '🇵🇹' },
  { name: 'Royaume-Uni', lat: 55.378051, lng: -3.435973, continent: 'Europe', emoji: '🇬🇧' },
  { name: 'Allemagne', lat: 51.165691, lng: 10.451526, continent: 'Europe', emoji: '🇩🇪' },
  { name: 'Suisse', lat: 46.818188, lng: 8.227512, continent: 'Europe', emoji: '🇨🇭' },
  { name: 'Autriche', lat: 47.516231, lng: 14.550072, continent: 'Europe', emoji: '🇦🇹' },
  { name: 'Grèce', lat: 39.074208, lng: 21.824312, continent: 'Europe', emoji: '🇬🇷' },
  { name: 'Pays-Bas', lat: 52.132633, lng: 5.291266, continent: 'Europe', emoji: '🇳🇱' },
  { name: 'Belgique', lat: 50.503887, lng: 4.469936, continent: 'Europe', emoji: '🇧🇪' },
  { name: 'Suède', lat: 60.128161, lng: 18.643501, continent: 'Europe', emoji: '🇸🇪' },
  { name: 'Norvège', lat: 60.472024, lng: 8.468946, continent: 'Europe', emoji: '🇳🇴' },
  { name: 'Danemark', lat: 56.26392, lng: 9.501785, continent: 'Europe', emoji: '🇩🇰' },
  { name: 'Finlande', lat: 61.92411, lng: 25.748151, continent: 'Europe', emoji: '🇫🇮' },
  { name: 'Islande', lat: 64.963051, lng: -19.020835, continent: 'Europe', emoji: '🇮🇸' },
  { name: 'Irlande', lat: 53.41291, lng: -8.24389, continent: 'Europe', emoji: '🇮🇪' },
  { name: 'Pologne', lat: 51.919438, lng: 19.145136, continent: 'Europe', emoji: '🇵🇱' },
  { name: 'Rép. Tchèque', lat: 49.817492, lng: 15.472962, continent: 'Europe', emoji: '🇨🇿' },
  { name: 'Hongrie', lat: 47.162494, lng: 19.503304, continent: 'Europe', emoji: '🇭🇺' },
  { name: 'Roumanie', lat: 45.943161, lng: 24.96676, continent: 'Europe', emoji: '🇷🇴' },
  { name: 'Croatie', lat: 45.1, lng: 15.2, continent: 'Europe', emoji: '🇭🇷' },
  { name: 'Malte', lat: 35.937496, lng: 14.375416, continent: 'Europe', emoji: '🇲🇹' },
  { name: 'Ukraine', lat: 48.379433, lng: 31.16558, continent: 'Europe', emoji: '🇺🇦' },
  { name: 'Turquie', lat: 38.963745, lng: 35.243322, continent: 'Asie', emoji: '🇹🇷' },
  { name: 'Russie', lat: 61.52401, lng: 105.318756, continent: 'Europe', emoji: '🇷🇺' },
  { name: 'Japon', lat: 36.204824, lng: 138.252924, continent: 'Asie', emoji: '🇯🇵' },
  { name: 'Chine', lat: 35.86166, lng: 104.195397, continent: 'Asie', emoji: '🇨🇳' },
  { name: 'Inde', lat: 20.593684, lng: 78.96288, continent: 'Asie', emoji: '🇮🇳' },
  { name: 'Thaïlande', lat: 15.870032, lng: 100.992541, continent: 'Asie', emoji: '🇹🇭' },
  { name: 'Vietnam', lat: 14.058324, lng: 108.277199, continent: 'Asie', emoji: '🇻🇳' },
  { name: 'Indonésie', lat: -0.789275, lng: 113.921327, continent: 'Asie', emoji: '🇮🇩' },
  { name: 'Corée du Sud', lat: 35.907757, lng: 127.766922, continent: 'Asie', emoji: '🇰🇷' },
  { name: 'Singapour', lat: 1.352083, lng: 103.819836, continent: 'Asie', emoji: '🇸🇬' },
  { name: 'Maldives', lat: 3.202778, lng: 73.22068, continent: 'Asie', emoji: '🇲🇻' },
  { name: 'Émirats Arabes Unis', lat: 23.424076, lng: 53.847818, continent: 'Asie', emoji: '🇦🇪' },
  { name: 'Israël', lat: 31.046051, lng: 34.851612, continent: 'Asie', emoji: '🇮🇱' },
  { name: 'Jordanie', lat: 30.585164, lng: 36.238414, continent: 'Asie', emoji: '🇯🇴' },
  { name: 'Cambodge', lat: 12.565679, lng: 104.990963, continent: 'Asie', emoji: '🇰🇭' },
  { name: 'Philippines', lat: 12.879721, lng: 121.774017, continent: 'Asie', emoji: '🇵🇭' },
  { name: 'Népal', lat: 28.394857, lng: 84.124008, continent: 'Asie', emoji: '🇳🇵' },
  { name: 'Sri Lanka', lat: 7.873054, lng: 80.771797, continent: 'Asie', emoji: '🇱🇰' },
  { name: 'États-Unis', lat: 37.09024, lng: -95.712891, continent: 'Amérique', emoji: '🇺🇸' },
  { name: 'Canada', lat: 56.130366, lng: -106.346771, continent: 'Amérique', emoji: '🇨🇦' },
  { name: 'Mexique', lat: 23.634501, lng: -102.552784, continent: 'Amérique', emoji: '🇲🇽' },
  { name: 'Brésil', lat: -14.235004, lng: -51.92528, continent: 'Amérique', emoji: '🇧🇷' },
  { name: 'Argentine', lat: -38.416097, lng: -63.616672, continent: 'Amérique', emoji: '🇦🇷' },
  { name: 'Colombie', lat: 4.570868, lng: -74.297333, continent: 'Amérique', emoji: '🇨🇴' },
  { name: 'Pérou', lat: -9.189967, lng: -75.015152, continent: 'Amérique', emoji: '🇵🇪' },
  { name: 'Cuba', lat: 21.521757, lng: -77.781167, continent: 'Amérique', emoji: '🇨🇺' },
  { name: 'Costa Rica', lat: 9.748917, lng: -83.753428, continent: 'Amérique', emoji: '🇨🇷' },
  { name: 'Rép. Dominicaine', lat: 18.735693, lng: -70.162651, continent: 'Amérique', emoji: '🇩🇴' },
  { name: 'Chili', lat: -35.675147, lng: -71.542969, continent: 'Amérique', emoji: '🇨🇱' },
  { name: 'Maroc', lat: 31.791702, lng: -7.09262, continent: 'Afrique', emoji: '🇲🇦' },
  { name: 'Égypte', lat: 26.820553, lng: 30.802498, continent: 'Afrique', emoji: '🇪🇬' },
  { name: 'Afrique du Sud', lat: -30.559482, lng: 22.937506, continent: 'Afrique', emoji: '🇿🇦' },
  { name: 'Kenya', lat: -0.023559, lng: 37.906193, continent: 'Afrique', emoji: '🇰🇪' },
  { name: 'Tanzanie', lat: -6.369028, lng: 34.888822, continent: 'Afrique', emoji: '🇹🇿' },
  { name: 'Sénégal', lat: 14.497401, lng: -14.452362, continent: 'Afrique', emoji: '🇸🇳' },
  { name: 'Tunisie', lat: 33.886917, lng: 9.537499, continent: 'Afrique', emoji: '🇹🇳' },
  { name: 'Madagascar', lat: -18.766947, lng: 46.869107, continent: 'Afrique', emoji: '🇲🇬' },
  { name: 'Maurice', lat: -20.348404, lng: 57.552152, continent: 'Afrique', emoji: '🇲🇺' },
  { name: 'Seychelles', lat: -4.679574, lng: 55.491977, continent: 'Afrique', emoji: '🇸🇨' },
  { name: 'Nigeria', lat: 9.081999, lng: 8.675277, continent: 'Afrique', emoji: '🇳🇬' },
  { name: 'Ghana', lat: 7.946527, lng: -1.023194, continent: 'Afrique', emoji: '🇬🇭' },
  { name: 'Australie', lat: -25.274398, lng: 133.775136, continent: 'Océanie', emoji: '🇦🇺' },
  { name: 'Nouvelle-Zélande', lat: -40.900557, lng: 174.885971, continent: 'Océanie', emoji: '🇳🇿' },
  { name: 'Fidji', lat: -17.713371, lng: 178.065032, continent: 'Océanie', emoji: '🇫🇯' },
  { name: 'Polynésie Française', lat: -17.679742, lng: -149.406843, continent: 'Océanie', emoji: '🇵🇫' },
]

// Persisted visited state
const STORAGE_KEY = 'nousdeux-visited'
const visited = ref<string[]>([])

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) visited.value = JSON.parse(saved)
})

function saveVisited() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visited.value))
}

function isVisited(name: string) { return visited.value.includes(name) }
function toggleVisited(name: string) {
  const idx = visited.value.indexOf(name)
  if (idx >= 0) visited.value.splice(idx, 1)
  else visited.value.push(name)
  saveVisited()
  updateMarkers()
}

// Filters
const search = ref('')
const continentFilter = ref('')
const continents = ['', 'Europe', 'Asie', 'Amérique', 'Afrique', 'Océanie']

const filteredPlaces = computed(() => {
  return allPlaces.filter(p => {
    const matchSearch = !search.value || p.name.toLowerCase().includes(search.value.toLowerCase()) || p.continent.toLowerCase().includes(search.value.toLowerCase())
    const matchContinent = !continentFilter.value || p.continent === continentFilter.value
    return matchSearch && matchContinent
  })
})

// Map
const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: any = null
let markersLayer: any = null

onMounted(async () => {
  await nextTick()
  await new Promise(r => setTimeout(r, 200))
  
  const L = (await import('leaflet')).default
  
  if (mapContainer.value) {
    mapInstance = L.map(mapContainer.value, { center: [25, 0], zoom: 2, zoomControl: true, attributionControl: false, scrollWheelZoom: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(mapInstance)
    markersLayer = L.layerGroup().addTo(mapInstance)
    updateMarkers()
    setTimeout(() => mapInstance?.invalidateSize(), 300)
    gsap.fromTo('.place-card', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out', delay: 0.3 })
  }
})

function updateMarkers() {
  if (!markersLayer || !mapInstance) return
  markersLayer.clearLayers()
  const L = (window as any).L || mapInstance._leaflet
  
  // Need to re-import or use the L reference
  import('leaflet').then(({ default: Leaflet }) => {
    markersLayer.clearLayers()
    filteredPlaces.value.forEach(p => {
      const visitedIcon = Leaflet.divIcon({
        html: `<div style="font-size:18px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">${p.emoji}</div>`,
        className: 'custom-marker',
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
      const marker = Leaflet.marker([p.lat, p.lng], { icon: visitedIcon, opacity: isVisited(p.name) ? 1 : 0.35 })
        .addTo(markersLayer)
        .bindPopup(`<div style="color:#e8e8f0;font-family:Inter,sans-serif"><b>${p.emoji} ${p.name}</b><br><span style="font-size:11px;color:#888">${p.continent}</span>${!isVisited(p.name) ? '<br><span style="font-size:10px;color:#f0c060">✨ À visiter</span>' : '<br><span style="font-size:10px;color:#4adec0">✅ Visité</span>'}</div>`)
      marker.on('click', () => mapInstance?.flyTo([p.lat, p.lng], 5, { duration: 0.8 }))
    })
  })
}

function flyToPlace(p: any) {
  mapInstance?.flyTo([p.lat, p.lng], 5, { duration: 0.8 })
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="text-center mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:globe" class="w-6 sm:w-7 h-6 sm:h-7 text-gold" /> Notre Carte
      </h1>
      <p class="text-text-muted text-sm">{{ visited.length }} pays visités · {{ allPlaces.length - visited.length }} à découvrir</p>
    </div>

    <!-- Search + Filters -->
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

    <!-- Map -->
    <div ref="mapContainer" class="w-full h-[350px] sm:h-[450px] rounded-2xl border border-border overflow-hidden mb-6" />

    <!-- Countries grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      <div v-for="p in filteredPlaces" :key="p.name"
        class="place-card bg-surface border rounded-xl p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] group flex items-center gap-3"
        :class="isVisited(p.name) ? 'border-gold/30 bg-gold/5' : 'border-border hover:border-lavender/30'"
        @click="flyToPlace(p)">
        <span class="text-xl flex-shrink-0" :class="isVisited(p.name) ? '' : 'opacity-40 grayscale'">{{ p.emoji }}</span>
        <span class="text-sm font-medium text-text truncate flex-1">{{ p.name }}</span>
        <button @click.stop="toggleVisited(p.name)" class="text-xs flex-shrink-0 transition-colors"
          :class="isVisited(p.name) ? 'text-gold hover:text-rose' : 'text-text-muted hover:text-gold'">
          {{ isVisited(p.name) ? '✅' : '☆' }}
        </button>
      </div>
    </div>
    <p v-if="filteredPlaces.length === 0" class="text-center py-8 text-text-muted">Aucun pays trouvé</p>
  </div>
</template>

<style>
.leaflet-container { width: 100% !important; height: 100% !important; background: #1a1a24; z-index: 1; }
.leaflet-popup-content-wrapper { background: #1a1a24 !important; color: #e8e8f0 !important; border: 1px solid #2a2a3e !important; border-radius: 12px !important; }
.leaflet-popup-tip { background: #1a1a24 !important; }
</style>
