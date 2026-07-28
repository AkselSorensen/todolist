<template>
  <div class="min-h-screen bg-dark">
    <nav ref="navRef" class="sticky top-0 z-50 bg-surface/90 backdrop-blur-lg border-b border-border opacity-0">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-3 group">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon icon="lucide:heart" class="w-5 h-5 text-white" />
          </div>
          <span class="text-lg font-bold text-text">Nous Deux</span>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <NuxtLink to="/todos" class="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
            :class="$route.path === '/todos' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:list-todo" class="w-4 h-4" /> Tâches
          </NuxtLink>
          <NuxtLink to="/calendrier" class="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
            :class="$route.path === '/calendrier' ? 'bg-surface2 text-text' : 'text-text-muted hover:text-text hover:bg-surface2'">
            <Icon icon="lucide:calendar-days" class="w-4 h-4" /> Calendrier
          </NuxtLink>
        </div>
      </div>
    </nav>
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { gsap } from 'gsap'

const navRef = ref<HTMLElement | null>(null)

onMounted(() => {
  nextTick(() => {
    gsap.to(navRef.value, { autoAlpha: 1, duration: 0.5, ease: 'power3.out', delay: 0.1 })
  })
})
</script>
