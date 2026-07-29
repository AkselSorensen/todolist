<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'auth' })

const { login, isAuthenticated } = useAuth()
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const formRef = ref<HTMLElement | null>(null)

// If already logged in, redirect
watchEffect(() => {
  if (isAuthenticated.value) navigateTo('/')
})

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    await login(email.value, password.value)
    navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Email ou mot de passe invalide'
    gsap.fromTo(formRef.value, { x: -4 }, { x: 4, duration: 0.05, repeat: 5, yoyo: true, ease: 'power2.inOut' })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  nextTick(() => {
    gsap.fromTo('.auth-card', { autoAlpha: 0, y: 30, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' })
    gsap.fromTo('.auth-field', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out', delay: 0.2 })
  })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-dark">
    <div ref="formRef" class="auth-card w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center mx-auto mb-4">
          <Icon icon="lucide:heart" class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-2xl font-bold">
          <span class="bg-gradient-to-r from-rose via-gold to-lavender bg-clip-text text-transparent">Nous Deux</span>
        </h1>
        <p class="text-text-muted text-sm mt-1">Connecte-toi pour continuer</p>
      </div>

      <!-- Error -->
      <Transition name="fade">
        <div v-if="error" class="mb-4 p-3 rounded-xl bg-rose/10 border border-rose/20 text-rose text-sm text-center">
          {{ error }}
        </div>
      </Transition>

      <!-- Form -->
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div class="auth-field">
          <label class="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Email</label>
          <input v-model="email" type="email" required autocomplete="email"
            class="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors"
            placeholder="ton@email.com" />
        </div>
        <div class="auth-field">
          <label class="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Mot de passe</label>
          <input v-model="password" type="password" required autocomplete="current-password"
            class="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-rose/50 transition-colors"
            placeholder="••••••••" />
        </div>
        <button type="submit" :disabled="submitting"
          class="auth-field w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Icon v-if="submitting" icon="lucide:loader-circle" class="w-4 h-4 animate-spin" />
          <span v-else>Se connecter</span>
        </button>
      </form>

      <!-- Register link -->
      <p class="text-center text-text-muted text-sm mt-6">
        Pas encore de compte ?
        <NuxtLink to="/auth/register" class="text-rose hover:text-rose-soft font-medium transition-colors ml-1">
          Créer un compte
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
