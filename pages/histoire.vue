<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

definePageMeta({ layout: 'default' })

const moments = [
  { date: '15 Mars 2024', title: 'Premier regard', icon: 'lucide:eye', desc: 'Ce moment où nos regards se sont croisés pour la première fois. Le début de tout.', color: '#ff6b8a' },
  { date: '22 Mars 2024', title: 'Premier rendez-vous', icon: 'lucide:heart', desc: 'Ce café qui a duré 4 heures sans qu\'on voie le temps passer. Les papillons dans le ventre.', color: '#ff6b8a' },
  { date: 'Avril 2024', title: 'Premier "je t\'aime"', icon: 'lucide:sparkles', desc: 'Sur le pont, au coucher du soleil. Le plus beau des moments.', color: '#f0c060' },
  { date: 'Juin 2024', title: 'Premier week-end ensemble', icon: 'lucide:home', desc: 'Première escapade, premiers petits-déjeuners à deux, premiers fous rires du matin.', color: '#a78bfa' },
  { date: 'Août 2024', title: 'Premier voyage — Venise', icon: 'lucide:plane', desc: 'Gondole, spritz sur la place Saint-Marc, se perdre dans les ruelles main dans la main.', color: '#4adec0' },
  { date: 'Octobre 2024', title: 'Emménagement', icon: 'lucide:package-open', desc: 'Les cartons, la peinture, monter les meubles à deux. Notre chez-nous.', color: '#ff6b8a' },
  { date: 'Décembre 2024', title: 'Premier Noël ensemble', icon: 'lucide:gift', desc: 'Le sapin, les cadeaux, le chocolat chaud. La magie de Noël à deux.', color: '#f0c060' },
  { date: '14 Février 2025', title: 'Saint-Valentin', icon: 'lucide:heart-handshake', desc: 'Dîner aux chandelles, lettres d\'amour, promesse d\'une vie de moments ensemble.', color: '#ff6b8a' },
  { date: 'Été 2025', title: 'Road trip en Europe', icon: 'lucide:car', desc: 'Barcelone, Rome, Amsterdam. Des milliers de kilomètres de souvenirs.', color: '#4adec0' },
  { date: 'Aujourd\'hui', title: 'Et la suite...', icon: 'lucide:infinity', desc: 'Pleins de projets, de rêves et de moments à écrire ensemble.', color: '#a78bfa' },
]

const timelineRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

onMounted(async () => {
  await nextTick()
  ctx = gsap.context(() => {
    gsap.registerPlugin(ScrollTrigger)
    gsap.fromTo('.hero-tl', { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' })
    gsap.fromTo('.moment-card', {
      autoAlpha: 0, x: -30,
      scrollTrigger: { trigger: timelineRef.value, start: 'top 85%', toggleActions: 'play none none none' }
    }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.12, ease: 'power3.out' })
  })
})

onUnmounted(() => { ctx?.revert(); ScrollTrigger.getAll().forEach(t => t.kill()) })
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <div class="hero-tl text-center mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:timeline" class="w-6 sm:w-7 h-6 sm:h-7 text-rose" /> Notre Histoire
      </h1>
      <p class="text-text-muted text-sm">Les moments qui ont construit notre chemin</p>
    </div>

    <div ref="timelineRef" class="relative">
      <!-- Timeline line -->
      <div class="absolute left-4 sm:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose via-gold to-lavender rounded-full" />

      <div class="space-y-6">
        <div v-for="(m, i) in moments" :key="i"
          class="moment-card relative pl-12 sm:pl-16">
          <!-- Dot -->
          <div class="absolute left-[10px] sm:left-[22px] w-4 h-4 rounded-full border-2 border-dark z-10 ring-2"
            :style="{ background: m.color, boxShadow: `0 0 10px ${m.color}40` }" />
          
          <!-- Card -->
          <div class="bg-surface border border-border rounded-2xl p-5 hover:border-rose/20 transition-all duration-300">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center" :style="{ background: m.color + '15' }">
                <Icon :icon="m.icon" class="w-4 h-4" :style="{ color: m.color }" />
              </div>
              <div>
                <p class="font-semibold text-sm text-text">{{ m.title }}</p>
                <p class="text-xs text-text-muted">{{ m.date }}</p>
              </div>
            </div>
            <p class="text-sm text-text-muted leading-relaxed">{{ m.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
