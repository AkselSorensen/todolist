<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }]
})

const allPlaces = [
  { name: 'France', en: 'France', lat: 46.6, lng: 2.3, continent: 'Europe', emoji: '🇫🇷' },
  { name: 'Italie', en: 'Italy', lat: 41.9, lng: 12.5, continent: 'Europe', emoji: '🇮🇹' },
  { name: 'Espagne', en: 'Spain', lat: 40.4, lng: -3.7, continent: 'Europe', emoji: '🇪🇸' },
  { name: 'Portugal', en: 'Portugal', lat: 39.4, lng: -8.2, continent: 'Europe', emoji: '🇵🇹' },
  { name: 'Royaume-Uni', en: 'United Kingdom', lat: 55.4, lng: -3.4, continent: 'Europe', emoji: '🇬🇧' },
  { name: 'Allemagne', en: 'Germany', lat: 51.2, lng: 10.5, continent: 'Europe', emoji: '🇩🇪' },
  { name: 'Suisse', en: 'Switzerland', lat: 46.8, lng: 8.2, continent: 'Europe', emoji: '🇨🇭' },
  { name: 'Autriche', en: 'Austria', lat: 47.5, lng: 14.6, continent: 'Europe', emoji: '🇦🇹' },
  { name: 'Grèce', en: 'Greece', lat: 39.1, lng: 21.8, continent: 'Europe', emoji: '🇬🇷' },
  { name: 'Pays-Bas', en: 'Netherlands', lat: 52.1, lng: 5.3, continent: 'Europe', emoji: '🇳🇱' },
  { name: 'Belgique', en: 'Belgium', lat: 50.5, lng: 4.5, continent: 'Europe', emoji: '🇧🇪' },
  { name: 'Suède', en: 'Sweden', lat: 60.1, lng: 18.6, continent: 'Europe', emoji: '🇸🇪' },
  { name: 'Norvège', en: 'Norway', lat: 60.5, lng: 8.5, continent: 'Europe', emoji: '🇳🇴' },
  { name: 'Danemark', en: 'Denmark', lat: 56.3, lng: 9.5, continent: 'Europe', emoji: '🇩🇰' },
  { name: 'Finlande', en: 'Finland', lat: 61.9, lng: 25.7, continent: 'Europe', emoji: '🇫🇮' },
  { name: 'Islande', en: 'Iceland', lat: 65.0, lng: -19.0, continent: 'Europe', emoji: '🇮🇸' },
  { name: 'Irlande', en: 'Ireland', lat: 53.4, lng: -8.2, continent: 'Europe', emoji: '🇮🇪' },
  { name: 'Pologne', en: 'Poland', lat: 51.9, lng: 19.1, continent: 'Europe', emoji: '🇵🇱' },
  { name: 'Rép. Tchèque', en: 'Czech Republic', lat: 49.8, lng: 15.5, continent: 'Europe', emoji: '🇨🇿' },
  { name: 'Hongrie', en: 'Hungary', lat: 47.2, lng: 19.5, continent: 'Europe', emoji: '🇭🇺' },
  { name: 'Roumanie', en: 'Romania', lat: 45.9, lng: 25.0, continent: 'Europe', emoji: '🇷🇴' },
  { name: 'Croatie', en: 'Croatia', lat: 45.1, lng: 15.2, continent: 'Europe', emoji: '🇭🇷' },
  { name: 'Ukraine', en: 'Ukraine', lat: 48.4, lng: 31.2, continent: 'Europe', emoji: '🇺🇦' },
  { name: 'Turquie', en: 'Turkey', lat: 39.0, lng: 35.2, continent: 'Asie', emoji: '🇹🇷' },
  { name: 'Russie', en: 'Russia', lat: 61.5, lng: 105.3, continent: 'Europe', emoji: '🇷🇺' },
  { name: 'Japon', en: 'Japan', lat: 36.2, lng: 138.3, continent: 'Asie', emoji: '🇯🇵' },
  { name: 'Chine', en: 'China', lat: 35.9, lng: 104.2, continent: 'Asie', emoji: '🇨🇳' },
  { name: 'Inde', en: 'India', lat: 20.6, lng: 79.0, continent: 'Asie', emoji: '🇮🇳' },
  { name: 'Thaïlande', en: 'Thailand', lat: 15.9, lng: 101.0, continent: 'Asie', emoji: '🇹🇭' },
  { name: 'Vietnam', en: 'Vietnam', lat: 14.1, lng: 108.3, continent: 'Asie', emoji: '🇻🇳' },
  { name: 'Indonésie', en: 'Indonesia', lat: -0.8, lng: 113.9, continent: 'Asie', emoji: '🇮🇩' },
  { name: 'Corée du Sud', en: 'South Korea', lat: 35.9, lng: 127.8, continent: 'Asie', emoji: '🇰🇷' },
  { name: 'Singapour', en: 'Singapore', lat: 1.4, lng: 103.8, continent: 'Asie', emoji: '🇸🇬' },
  { name: 'Maldives', en: 'Maldives', lat: 3.2, lng: 73.2, continent: 'Asie', emoji: '🇲🇻' },
  { name: 'Émirats A. U.', en: 'United Arab Emirates', lat: 23.4, lng: 53.8, continent: 'Asie', emoji: '🇦🇪' },
  { name: 'Israël', en: 'Israel', lat: 31.0, lng: 34.9, continent: 'Asie', emoji: '🇮🇱' },
  { name: 'Jordanie', en: 'Jordan', lat: 30.6, lng: 36.2, continent: 'Asie', emoji: '🇯🇴' },
  { name: 'Cambodge', en: 'Cambodia', lat: 12.6, lng: 105.0, continent: 'Asie', emoji: '🇰🇭' },
  { name: 'Philippines', en: 'Philippines', lat: 12.9, lng: 121.8, continent: 'Asie', emoji: '🇵🇭' },
  { name: 'Népal', en: 'Nepal', lat: 28.4, lng: 84.1, continent: 'Asie', emoji: '🇳🇵' },
  { name: 'Sri Lanka', en: 'Sri Lanka', lat: 7.9, lng: 80.8, continent: 'Asie', emoji: '🇱🇰' },
  { name: 'États-Unis', en: 'United States of America', lat: 37.1, lng: -95.7, continent: 'Amérique', emoji: '🇺🇸' },
  { name: 'Canada', en: 'Canada', lat: 56.1, lng: -106.3, continent: 'Amérique', emoji: '🇨🇦' },
  { name: 'Mexique', en: 'Mexico', lat: 23.6, lng: -102.6, continent: 'Amérique', emoji: '🇲🇽' },
  { name: 'Brésil', en: 'Brazil', lat: -14.2, lng: -51.9, continent: 'Amérique', emoji: '🇧🇷' },
  { name: 'Argentine', en: 'Argentina', lat: -38.4, lng: -63.6, continent: 'Amérique', emoji: '🇦🇷' },
  { name: 'Colombie', en: 'Colombia', lat: 4.6, lng: -74.3, continent: 'Amérique', emoji: '🇨🇴' },
  { name: 'Pérou', en: 'Peru', lat: -9.2, lng: -75.0, continent: 'Amérique', emoji: '🇵🇪' },
  { name: 'Cuba', en: 'Cuba', lat: 21.5, lng: -77.8, continent: 'Amérique', emoji: '🇨🇺' },
  { name: 'Costa Rica', en: 'Costa Rica', lat: 9.7, lng: -83.8, continent: 'Amérique', emoji: '🇨🇷' },
  { name: 'Rép. Dominicaine', en: 'Dominican Republic', lat: 18.7, lng: -70.2, continent: 'Amérique', emoji: '🇩🇴' },
  { name: 'Chili', en: 'Chile', lat: -35.7, lng: -71.5, continent: 'Amérique', emoji: '🇨🇱' },
  { name: 'Maroc', en: 'Morocco', lat: 31.8, lng: -7.1, continent: 'Afrique', emoji: '🇲🇦' },
  { name: 'Égypte', en: 'Egypt', lat: 26.8, lng: 30.8, continent: 'Afrique', emoji: '🇪🇬' },
  { name: 'Afrique du Sud', en: 'South Africa', lat: -30.6, lng: 22.9, continent: 'Afrique', emoji: '🇿🇦' },
  { name: 'Kenya', en: 'Kenya', lat: -0.02, lng: 37.9, continent: 'Afrique', emoji: '🇰🇪' },
  { name: 'Tanzanie', en: 'Tanzania', lat: -6.4, lng: 34.9, continent: 'Afrique', emoji: '🇹🇿' },
  { name: 'Sénégal', en: 'Senegal', lat: 14.5, lng: -14.5, continent: 'Afrique', emoji: '🇸🇳' },
  { name: 'Tunisie', en: 'Tunisia', lat: 33.9, lng: 9.5, continent: 'Afrique', emoji: '🇹🇳' },
  { name: 'Madagascar', en: 'Madagascar', lat: -18.8, lng: 46.9, continent: 'Afrique', emoji: '🇲🇬' },
  { name: 'Maurice', en: 'Mauritius', lat: -20.3, lng: 57.6, continent: 'Afrique', emoji: '🇲🇺' },
  { name: 'Seychelles', en: 'Seychelles', lat: -4.7, lng: 55.5, continent: 'Afrique', emoji: '🇸🇨' },
  { name: 'Nigeria', en: 'Nigeria', lat: 9.1, lng: 8.7, continent: 'Afrique', emoji: '🇳🇬' },
  { name: 'Ghana', en: 'Ghana', lat: 7.9, lng: -1.0, continent: 'Afrique', emoji: '🇬🇭' },
  { name: 'Australie', en: 'Australia', lat: -25.3, lng: 133.8, continent: 'Océanie', emoji: '🇦🇺' },
  { name: 'Nouvelle-Zélande', en: 'New Zealand', lat: -40.9, lng: 174.9, continent: 'Océanie', emoji: '🇳🇿' },
  { name: 'Fidji', en: 'Fiji', lat: -17.7, lng: 178.1, continent: 'Océanie', emoji: '🇫🇯' },
]

// Visited state from DB
const visited = ref<string[]>([])
async function loadVisited() { try { visited.value = await $fetch('/api/visited') } catch { visited.value = [] } }
async function toggleVisited(name: string) {
  try {
    const res = await $fetch('/api/visited', { method: 'POST', body: { country: name } })
    if (res.visited) visited.value.push(name)
    else visited.value = visited.value.filter(v => v !== name)
    updateGeoJSON()
    updateMarkers()
  } catch {}
}
function isVisited(name: string) { return visited.value.includes(name) }

// Filters
const search = ref('')
const continentFilter = ref('')
const continents = ['', 'Europe', 'Asie', 'Amérique', 'Afrique', 'Océanie']
const filteredPlaces = computed(() => allPlaces.filter(p => {
  const ms = !search.value || p.name.toLowerCase().includes(search.value.toLowerCase()) || p.continent.toLowerCase().includes(search.value.toLowerCase())
  const mc = !continentFilter.value || p.continent === continentFilter.value
  return ms && mc
}))

// Map
const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: any = null
let markersLayer: any = null
let geoJsonLayer: any = null
let LeafletModule: any = null
let geoJsonData: any = null

onMounted(async () => {
  await loadVisited()
  await nextTick()
  await new Promise(r => setTimeout(r, 200))

  // Load GeoJSON country boundaries
  try {
    const resp = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geojson')
    geoJsonData = await resp.json()
  } catch { /* map will work without country fill */ }

  LeafletModule = await import('leaflet')
  const L = LeafletModule.default

  if (mapContainer.value) {
    mapInstance = L.map(mapContainer.value, { center: [25, 0], zoom: 2, zoomControl: true, attributionControl: false, scrollWheelZoom: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(mapInstance)
    markersLayer = L.layerGroup().addTo(mapInstance)

    // Add GeoJSON layer for country fills
    if (geoJsonData) {
      const visitedNames = allPlaces.filter(p => isVisited(p.name)).map(p => p.en)
      geoJsonLayer = L.geoJSON(geoJsonData, {
        style: (feature: any) => {
          const name = feature?.properties?.name
          return visitedNames.includes(name)
            ? { fillColor: '#F5A623', fillOpacity: 0.35, color: '#F5A623', weight: 1.5, opacity: 0.8 }
            : { fillOpacity: 0, color: 'transparent', weight: 0 }
        },
      }).addTo(mapInstance)
    }

    updateMarkers()
    setTimeout(() => mapInstance?.invalidateSize(), 300)
    gsap.fromTo('.place-card', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out', delay: 0.3 })
  }
})

function updateGeoJSON() {
  if (!geoJsonLayer) return
  const visitedNames = allPlaces.filter(p => isVisited(p.name)).map(p => p.en)
  geoJsonLayer.setStyle((feature: any) => {
    const name = feature?.properties?.name
    return visitedNames.includes(name)
      ? { fillColor: '#F5A623', fillOpacity: 0.35, color: '#F5A623', weight: 1.5, opacity: 0.8 }
      : { fillOpacity: 0, color: 'transparent', weight: 0 }
  })
}

function updateMarkers() {
  if (!markersLayer || !mapInstance || !LeafletModule) return
  const Leaflet = LeafletModule.default
  markersLayer.clearLayers()

  filteredPlaces.value.forEach(p => {
    const v = isVisited(p.name)
    const html = v
      ? `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
           <div style="position:absolute;inset:-4px;border-radius:50%;background:radial-gradient(circle,#f0c06040 0%,#f0c06020 60%,transparent 70%);animation:pulse 2s ease-in-out infinite"></div>
           <div style="position:absolute;inset:-2px;border-radius:50%;border:2px solid #f0c06060;box-shadow:0 0 12px #f0c06040"></div>
           <span style="font-size:18px;position:relative;z-index:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.8))">${p.emoji}</span>
         </div>`
      : `<div style="opacity:.4;filter:grayscale(.6)"><span style="font-size:16px">${p.emoji}</span></div>`

    const icon = Leaflet.divIcon({ html, className: 'custom-marker', iconSize: v ? [44, 44] : [28, 28], iconAnchor: v ? [22, 22] : [14, 14] })
    Leaflet.marker([p.lat, p.lng], { icon }).addTo(markersLayer)
      .bindPopup(`<div style="color:#e8e8f0;font-family:Inter,sans-serif"><b>${p.emoji} ${p.name}</b><br><span style="font-size:11px;color:#888">${p.continent}</span>${!v ? '<br><span style="font-size:10px;color:#f0c060">✨ À visiter</span>' : '<br><span style="font-size:10px;color:#F5A623">🍭 Visité !</span>'}</div>`)
  })
}

function flyToPlace(p: any) { mapInstance?.flyTo([p.lat, p.lng], 5, { duration: 0.8 }) }
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="text-center mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:globe" class="w-6 sm:w-7 h-6 sm:h-7 text-gold" /> Notre Carte
      </h1>
      <p class="text-text-muted text-sm">{{ visited.length }} pays visités · {{ allPlaces.length - visited.length }} à découvrir</p>
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
.leaflet-container { background: #1a1a24; z-index: 1; }
.leaflet-popup-content-wrapper { background: #1a1a24 !important; color: #e8e8f0 !important; border: 1px solid #2a2a3e !important; border-radius: 12px !important; }
.leaflet-popup-tip { background: #1a1a24 !important; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } }
</style>
