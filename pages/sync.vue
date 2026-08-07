<script setup lang="ts">
definePageMeta({ layout: 'default' })

const calendarUrl = computed(() => {
  if (typeof window !== 'undefined') return `${window.location.origin}/api/calendar.ics`
  return '/api/calendar.ics'
})

const webcalUrl = computed(() => {
  return calendarUrl.value.replace('https://', 'webcal://').replace('http://', 'webcal://')
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <div class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3 mb-2">
        <Icon icon="lucide:refresh-cw" class="w-6 sm:w-7 h-6 sm:h-7 text-lavender" />
        Synchroniser le calendrier
      </h1>
      <p class="text-text-muted text-sm">Ajoute le calendrier Nous Deux à ton PC, Mac ou téléphone</p>
    </div>

    <!-- ICS URL Card -->
    <div class="bg-surface border border-border rounded-2xl p-6 mb-6">
      <p class="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon icon="lucide:link" class="w-4 h-4 text-lavender" /> URL du calendrier
      </p>
      <div class="flex gap-2">
        <input :value="calendarUrl" readonly
          class="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-xs sm:text-sm focus:outline-none font-mono select-all" />
        <button @click="navigator.clipboard?.writeText(calendarUrl)"
          class="px-4 py-2.5 rounded-xl bg-lavender/15 text-lavender border border-lavender/30 text-sm font-medium hover:bg-lavender/20 transition-colors flex items-center gap-1.5 flex-shrink-0">
          <Icon icon="lucide:copy" class="w-4 h-4" /> Copier
        </button>
      </div>
    </div>

    <!-- Instructions -->
    <div class="space-y-4">
      <!-- Windows / Outlook -->
      <div class="bg-surface border border-border rounded-2xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <Icon icon="lucide:monitor" class="w-5 h-5 text-lavender" />
          <h3 class="font-bold text-sm">Windows / Outlook</h3>
        </div>
        <ol class="text-sm text-text-muted space-y-2 list-decimal list-inside">
          <li>Ouvre <strong>Outlook</strong> ou l'application <strong>Calendrier Windows</strong></li>
          <li>Clique sur <strong>Ajouter un calendrier</strong> → <strong>À partir d'Internet</strong></li>
          <li>Colle l'URL du calendrier ci-dessus</li>
          <li>Clique sur <strong>OK</strong> — le calendrier se synchronise automatiquement</li>
        </ol>
        <a :href="webcalUrl"
          class="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-lavender/10 text-lavender text-sm font-medium hover:bg-lavender/20 transition-colors">
          <Icon icon="lucide:external-link" class="w-3.5 h-3.5" /> Ouvrir avec l'app Calendrier
        </a>
      </div>

      <!-- Mac / Apple Calendar -->
      <div class="bg-surface border border-border rounded-2xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <Icon icon="lucide:apple" class="w-5 h-5 text-lavender" />
          <h3 class="font-bold text-sm">Mac / iPhone / iPad</h3>
        </div>
        <ol class="text-sm text-text-muted space-y-2 list-decimal list-inside">
          <li>Ouvre <strong>Réglages</strong> → <strong>Calendrier</strong> → <strong>Comptes</strong> → <strong>Ajouter un compte</strong></li>
          <li>Choisis <strong>Autre</strong> → <strong>Ajouter un calendrier d'abonnement</strong></li>
          <li>Colle l'URL ci-dessus</li>
          <li>Le calendrier apparaît dans l'app Calendrier et se sync automatiquement</li>
        </ol>
        <a :href="webcalUrl"
          class="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-lavender/10 text-lavender text-sm font-medium hover:bg-lavender/20 transition-colors">
          <Icon icon="lucide:external-link" class="w-3.5 h-3.5" /> Ouvrir avec Calendrier
        </a>
      </div>

      <!-- Google Calendar -->
      <div class="bg-surface border border-border rounded-2xl p-5">
        <div class="flex items-center gap-3 mb-3">
          <Icon icon="lucide:calendar" class="w-5 h-5 text-lavender" />
          <h3 class="font-bold text-sm">Google Calendar</h3>
        </div>
        <ol class="text-sm text-text-muted space-y-2 list-decimal list-inside">
          <li>Ouvre <strong>Google Calendar</strong> sur ton navigateur</li>
          <li>Dans la barre de gauche, clique sur <strong>+</strong> à côté de "Autres calendriers"</li>
          <li>Choisis <strong>À partir d'une URL</strong></li>
          <li>Colle l'URL ci-dessus et clique sur <strong>Ajouter un calendrier</strong></li>
        </ol>
      </div>
    </div>

    <!-- Tips -->
    <div class="mt-6 bg-gold/5 border border-gold/20 rounded-2xl p-5">
      <p class="text-sm font-semibold text-gold flex items-center gap-2 mb-2">
        <Icon icon="lucide:info" class="w-4 h-4" /> À savoir
      </p>
      <ul class="text-xs text-text-muted space-y-1.5 list-disc list-inside">
        <li>Le calendrier se met à jour automatiquement toutes les 1-24h selon l'app</li>
        <li>Les événements ajoutés ici apparaissent sur <strong>tous tes appareils</strong> connectés</li>
        <li>Tu peux aussi y accéder depuis le lien <strong>Sync calendrier</strong> en bas de la page Calendrier</li>
      </ul>
    </div>
  </div>
</template>
