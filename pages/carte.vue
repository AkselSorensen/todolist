<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

useHead({
  link: [{ rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }]
})

// All data from DB
const allPlaces = ref<any[]>([])
const visited = ref<string[]>([])

async function loadCountries() { try { allPlaces.value = await $fetch('/api/countries') } catch { allPlaces.value = [] } }
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

const search = ref('')
const continentFilter = ref('')
const continents = computed(() => ['', ...new Set(allPlaces.value.map((p: any) => p.continent))])
const filteredPlaces = computed(() => allPlaces.value.filter((p: any) => {
  const ms = !search.value || p.name.toLowerCase().includes(search.value.toLowerCase()) || p.continent.toLowerCase().includes(search.value.toLowerCase())
  const mc = !continentFilter.value || p.continent === continentFilter.value
  return ms && mc
}))

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
  const visitedNames = allPlaces.value.filter((p: any) => isVisited(p.name)).map((p: any) => p.en)
  geoJsonLayer.setStyle((feature: any) => {
    const name = feature?.properties?.name
    return visitedNames.includes(name)
      ? { fillColor: '#F5A623', fillOpacity: 0.35, color: '#F5A623', weight: 1.5, opacity: 0.8 }
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
    const icon = L.divIcon({ html, className: 'custom-marker', iconSize: [28, 28], iconAnchor: [14, 14], 
      ...(v ? { className: 'custom-marker visited' } : {}) })
    L.marker([p.lat, p.lng], { icon, opacity: v ? 1 : 0.35 })
      .addTo(markersLayer)
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
</style>
