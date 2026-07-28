<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'default' })

const places = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522, emoji: '🗼', desc: 'Tour Eiffel, Montmartre, notre premier Paris' },
  { name: 'Venise', lat: 45.4408, lng: 12.3155, emoji: '🛶', desc: 'Balade en gondole, pont des soupirs' },
  { name: 'Barcelone', lat: 41.3874, lng: 2.1686, emoji: '🏖️', desc: 'Sagrada, tapas, plage' },
  { name: 'Rome', lat: 41.9028, lng: 12.4964, emoji: '🏛️', desc: 'Colisée, fontaine de Trevi, gelato' },
  { name: 'Londres', lat: 51.5074, lng: -0.1278, emoji: '🎡', desc: 'London Eye, Big Ben, pubs' },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, emoji: '🌷', desc: 'Canaux, vélos, musées' },
  { name: 'Lisbonne', lat: 38.7223, lng: -9.1393, emoji: '🚃', desc: 'Tram 28, Belém, pasteis de nata' },
  { name: 'Prague', lat: 50.0755, lng: 14.4378, emoji: '🏰', desc: 'Pont Charles, château, bière tchèque' },
  { name: 'Santorin', lat: 36.3932, lng: 25.4615, emoji: '🌅', desc: 'Coucher de soleil, maisons blanches' },
  { name: 'New York', lat: 40.7128, lng: -74.0060, emoji: '🗽', desc: 'Times Square, Central Park' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, emoji: '🍣', desc: 'Shibuya, temples, sushi' },
  { name: 'Bali', lat: -8.3405, lng: 115.092, emoji: '🌴', desc: 'Rizières, temples, plages paradisiaques' },
]

const visited = ref([0, 1, 2, 3, 4, 5]) // indexes of visited places
const mapContainer = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
let mapInstance: any = null

const markers: any[] = []

onMounted(async () => {
  await nextTick()
  
  gsap.fromTo(heroRef.value, { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' })
  
  const L = (await import('leaflet')).default
  
  if (mapContainer.value) {
    mapInstance = L.map(mapContainer.value, {
      center: [46, 2],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(mapInstance)

    const visitedIcon = L.divIcon({
      html: '<div style="font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">📍</div>',
      className: 'custom-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    })

    const dreamIcon = L.divIcon({
      html: '<div style="font-size:16px;opacity:.5;filter:grayscale(.5)">📍</div>',
      className: 'custom-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    })

    places.forEach((p, i) => {
      const isVisited = visited.value.includes(i)
      const icon = isVisited ? visitedIcon : dreamIcon
      const marker = L.marker([p.lat, p.lng], { icon })
        .addTo(mapInstance)
        .bindPopup(`<div style="color:#e8e8f0;font-family:Inter,sans-serif"><b>${p.emoji} ${p.name}</b><br><span style="font-size:12px;color:#888">${p.desc}</span>${!isVisited ? '<br><span style="font-size:10px;color:#f0c060">✨ À visiter</span>' : ''}</div>`)
      markers.push(marker)
    })

    // Animate in
    gsap.fromTo('.place-card', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out', delay: 0.3 })
  }
})

onUnmounted(() => { if (mapInstance) mapInstance.remove() })

function flyTo(index: number) {
  const p = places[index]
  mapInstance?.flyTo([p.lat, p.lng], 6, { duration: 1 })
  markers[index]?.openPopup()
}

function toggleVisited(index: number) {
  const idx = visited.value.indexOf(index)
  if (idx >= 0) visited.value.splice(idx, 1)
  else visited.value.push(index)
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div ref="heroRef" class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:globe" class="w-6 sm:w-7 h-6 sm:h-7 text-gold" /> Notre Carte
      </h1>
      <p class="text-text-muted text-sm">{{ visited.length }} endroits visités · {{ places.length - visited.length }} à découvrir</p>
    </div>

    <!-- Map -->
    <div ref="mapContainer" class="w-full h-[350px] sm:h-[450px] rounded-2xl border border-border overflow-hidden mb-6" />

    <!-- Places list -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="(p, i) in places" :key="i"
        class="place-card bg-surface border rounded-2xl p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] group"
        :class="visited.includes(i) ? 'border-gold/30 bg-gold/5' : 'border-border hover:border-lavender/30'"
        @click="flyTo(i)">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xl">{{ p.emoji }}</span>
          <span class="text-sm font-semibold text-text">{{ p.name }}</span>
        </div>
        <p class="text-xs text-text-muted">{{ p.desc }}</p>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-[9px] px-1.5 py-0.5 rounded-full border"
            :class="visited.includes(i) ? 'border-gold/30 text-gold bg-gold/10' : 'border-border text-text-muted'">
            {{ visited.includes(i) ? '✅ Visitée' : '✨ À visiter' }}
          </span>
          <button @click.stop="toggleVisited(i)" class="text-[9px] text-text-muted hover:text-gold transition-colors ml-auto">
            {{ visited.includes(i) ? 'Retirer' : 'Marquer visité' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
