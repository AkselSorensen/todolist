<script setup lang="ts">
import { gsap } from 'gsap'

definePageMeta({ layout: 'auth' })

const { register, isAuthenticated } = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

watchEffect(() => {
  if (isAuthenticated.value) navigateTo('/')
})

async function onSubmit() {
  error.value = ''
  if (password.value.length < 6) {
    error.value = 'Le mot de passe doit faire au moins 6 caractères'
    return
  }
  submitting.value = true
  try {
    await register(email.value, password.value, name.value)
    navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Erreur lors de l\'inscription'
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
    <div class="auth-card w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-lavender to-rose flex items-center justify-center mx-auto mb-4">
          <Icon icon="lucide:user-plus" class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-2xl font-bold">
          <span class="bg-gradient-to-r from-rose via-gold to-lavender bg-clip-text text-transparent">Nous Deux</span>
        </h1>
        <p class="text-text-muted text-sm mt-1">Crée ton compte pour commencer</p>
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
          <label class="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Prénom</label>
          <input v-model="name" type="text" required autocomplete="given-name"
            class="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors"
            placeholder="Ton prénom" />
        </div>
        <div class="auth-field">
          <label class="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Email</label>
          <input v-model="email" type="email" required autocomplete="email"
            class="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors"
            placeholder="ton@email.com" />
        </div>
        <div class="auth-field">
          <label class="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Mot de passe</label>
          <input v-model="password" type="password" required autocomplete="new-password"
            class="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-lavender/50 transition-colors"
            placeholder="6 caractères minimum" />
        </div>
        <button type="submit" :disabled="submitting"
          class="auth-field w-full py-3 rounded-xl bg-gradient-to-r from-lavender to-rose text-white font-semibold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Icon v-if="submitting" icon="lucide:loader-circle" class="w-4 h-4 animate-spin" />
          <span v-else>Créer mon compte</span>
        </button>
      </form>

      <!-- Login link -->
      <p class="text-center text-text-muted text-sm mt-6">
        Déjà un compte ?
        <NuxtLink to="/auth/login" class="text-lavender hover:text-lavender-soft font-medium transition-colors ml-1">
          Se connecter
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
