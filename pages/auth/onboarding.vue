<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'auth' })

const { account, invitePartner, hasPartner } = useAuth()
const partnerEmail = ref('')
const error = ref('')
const submitting = ref(false)
const invited = ref(false)

// Redirect if already partnered
watchEffect(() => {
  if (hasPartner.value) navigateTo('/')
})

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    await invitePartner(partnerEmail.value)
    invited.value = true
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Erreur lors de l\'invitation'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  nextTick(() => {
    gsap.fromTo('.onboard-card', { autoAlpha: 0, y: 30, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' })
  })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-dark">
    <div class="onboard-card w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-rose via-gold to-lavender flex items-center justify-center mx-auto mb-4 p-[2px]">
          <div class="w-full h-full rounded-full bg-dark flex items-center justify-center">
            <span class="text-3xl">💞</span>
          </div>
        </div>
        <h1 class="text-xl font-bold">Ton partenaire</h1>
        <p class="text-text-muted text-sm mt-2">
          {{ account?.name }}, invite la personne avec qui tu veux partager ta carte, vos tâches et votre calendrier.
        </p>
      </div>

      <!-- Success -->
      <div v-if="invited" class="text-center">
        <div class="w-16 h-16 rounded-full bg-mint/20 flex items-center justify-center mx-auto mb-4">
          <Icon icon="lucide:check" class="w-8 h-8 text-mint" />
        </div>
        <p class="text-lg font-semibold mb-2">Invitation envoyée !</p>
        <p class="text-text-muted text-sm mb-6">
          {{ partnerEmail }} est maintenant ton/ta partenaire. Vous pouvez commencer à explorer ensemble.
        </p>
        <NuxtLink to="/"
          class="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-105 transition-transform">
          C'est parti !
        </NuxtLink>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="onSubmit" class="space-y-4">
        <Transition name="fade">
          <div v-if="error" class="p-3 rounded-xl bg-rose/10 border border-rose/20 text-rose text-sm text-center">
            {{ error }}
          </div>
        </Transition>

        <div>
          <label class="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Email de ton/ta partenaire</label>
          <input v-model="partnerEmail" type="email" required
            class="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors"
            placeholder="partenaire@email.com" />
          <p class="text-xs text-text-muted mt-1.5">Ton/ta partenaire doit déjà avoir créé un compte.</p>
        </div>

        <button type="submit" :disabled="submitting"
          class="w-full py-3 rounded-xl bg-gradient-to-r from-rose via-gold to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Icon v-if="submitting" icon="lucide:loader-circle" class="w-4 h-4 animate-spin" />
          <Icon v-else icon="lucide:heart" class="w-4 h-4" />
          <span>Inviter</span>
        </button>

        <NuxtLink to="/"
          class="block text-center text-text-muted text-sm hover:text-text transition-colors py-2">
          Plus tard — continuer sans partenaire
        </NuxtLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
