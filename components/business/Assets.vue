<script setup lang="ts">
import { gsap } from 'gsap'

const props = withDefaults(defineProps<{ owner?: number | null; heading?: string }>(), {
  owner: null,
  heading: "Ce qu'on possède déjà",
})

const api = useApi()

// Propriétaires possibles : soit Amandine, soit Aksel, soit en commun
const OWNERS = [
  { id: 4, name: 'Aksel', color: '#4da6ff' },
  { id: 5, name: 'Amandine', color: '#ff6b8a' },
  { id: null, name: 'Nous deux', color: '#f0c060' },
]

const CATEGORIES = [
  { key: 'crypto', label: 'Crypto', icon: 'lucide:bitcoin' },
  { key: 'stocks', label: 'Bourse', icon: 'lucide:chart-line' },
  { key: 'real_estate', label: 'Immobilier', icon: 'lucide:building-2' },
  { key: 'savings', label: 'Épargne', icon: 'lucide:piggy-bank' },
  { key: 'business', label: 'Parts de société', icon: 'lucide:briefcase' },
  { key: 'other', label: 'Autre', icon: 'lucide:package' },
]
const catOf = (k: string) => CATEGORIES.find(c => c.key === k) || CATEGORIES[CATEGORIES.length - 1]
const ownerOf = (id: number | null) => OWNERS.find(o => o.id === id) || OWNERS[2]

const assets = ref<any[]>([])
const loading = ref(true)
const errorMsg = ref('')
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const pendingDelete = ref<number | null>(null)

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0)

async function load() {
  try {
    assets.value = (await api.fetchBusinessAssets(props.owner ? { owner: props.owner } : undefined)) || []
    errorMsg.value = ''
    errorMsg.value = ''
  } catch {
    assets.value = []
    errorMsg.value = "Impossible de charger ce qu'on possède."
  }
  loading.value = false
  await nextTick()
  animate()
}

let ctx: gsap.Context | null = null
function animate() {
  ctx?.revert()
  ctx = gsap.context(() => {
    gsap.fromTo('.asset-row', { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.32, stagger: 0.04, ease: 'power3.out' })
  })
}

onMounted(load)
onUnmounted(() => ctx?.revert())

const total = computed(() => assets.value.reduce((a, x) => a + (Number(x.value) || 0), 0))

// Regroupé par propriétaire, dans l'ordre Aksel / Amandine / commun
const groups = computed(() => OWNERS.map(o => {
  const items = assets.value.filter(a => (a.owner_id ?? null) === o.id)
  return { ...o, items, subtotal: items.reduce((s, x) => s + (Number(x.value) || 0), 0) }
}).filter(g => g.items.length > 0))

/* ---------- formulaire ---------- */
const blank = () => ({ name: '', owner_id: (props.owner ?? 4) as number | null, category: 'crypto', value: 0, quantity: '', notes: '' })
const form = reactive(blank())

function openCreate() {
  Object.assign(form, blank())
  editing.value = null
  errorMsg.value = ''
  showModal.value = true
}
function openEdit(a: any) {
  Object.assign(form, blank(), {
    name: a.name || '', owner_id: a.owner_id ?? null, category: a.category || 'other',
    value: Number(a.value) || 0, quantity: a.quantity ?? '', notes: a.notes || '',
  })
  editing.value = { ...a }
  errorMsg.value = ''
  showModal.value = true
}
defineExpose({ openCreate })

async function onSubmit() {
  if (!form.name.trim() || saving.value) return
  const payload = {
    name: form.name.trim(),
    owner_id: form.owner_id === null ? null : Number(form.owner_id),
    category: form.category,
    value: Number(form.value) || 0,
    quantity: form.quantity === '' ? null : Number(form.quantity),
    notes: form.notes,
  }
  saving.value = true
  try {
    if (editing.value) await api.updateBusinessAsset(editing.value.id, payload)
    else await api.createBusinessAsset(payload)
    showModal.value = false
    editing.value = null
    await load()
  } catch {
    errorMsg.value = "Enregistrement impossible. Réessaie."
  } finally {
    saving.value = false
  }
}

async function removeAsset(id: number) {
  try {
    await api.deleteBusinessAsset(id)
    pendingDelete.value = null
    await load()
  } catch { errorMsg.value = 'Suppression impossible.' }
}
</script>

<template>
  <section class="mt-10">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 class="text-base font-bold flex items-center gap-2">
          <Icon icon="lucide:wallet" class="w-4 h-4 text-gold" />
          {{ heading }}
        </h2>
        <p class="text-text-muted text-xs mt-0.5">
          {{ assets.length }} actif{{ assets.length > 1 ? 's' : '' }} · <b class="text-gold">{{ eur(total) }}</b> au total
        </p>
      </div>
      <button @click="openCreate"
        class="px-3.5 py-2 rounded-xl border border-border bg-surface text-text text-xs font-medium hover:border-gold/40 transition-colors flex items-center gap-1.5 flex-shrink-0">
        <Icon icon="lucide:plus" class="w-3.5 h-3.5" /> Ajouter un actif
      </button>
    </div>

    <p v-if="errorMsg" class="mb-3 text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{{ errorMsg }}</p>

    <div v-if="loading" class="text-center py-10 text-text-muted text-sm">
      <Icon icon="lucide:loader-circle" class="w-7 h-7 mx-auto animate-spin mb-2" />
      Chargement...
    </div>

    <div v-else-if="assets.length === 0" class="bg-surface/50 border border-dashed border-border rounded-xl p-6 text-center">
      <Icon icon="lucide:wallet" class="w-6 h-6 mx-auto mb-2 text-text-muted opacity-50" />
      <p class="text-sm text-text-muted mb-3">Rien d'enregistré — ajoute ce que vous possédez déjà, à l'un ou à l'autre.</p>
      <button @click="openCreate"
        class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-xs font-semibold flex items-center gap-1.5 mx-auto">
        <Icon icon="lucide:plus" class="w-3.5 h-3.5" /> Ajouter un actif
      </button>
    </div>

    <!-- Groupes par propriétaire -->
    <div v-else class="space-y-4">
      <div v-for="g in groups" :key="String(g.id)" class="bg-surface border border-border rounded-xl overflow-hidden">
        <div v-if="!props.owner" class="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface2/50 border-b border-border">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              :style="{ background: g.color }">{{ g.name.charAt(0) }}</span>
            <span class="text-sm font-semibold truncate">{{ g.name }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-surface2 text-text-muted">{{ g.items.length }}</span>
          </div>
          <span class="text-sm font-bold text-gold flex-shrink-0">{{ eur(g.subtotal) }}</span>
        </div>

        <div class="divide-y divide-border/60">
          <div v-for="a in g.items" :key="a.id" class="asset-row flex items-center gap-3 px-4 py-3 hover:bg-surface2/40 transition-colors">
            <div class="w-8 h-8 rounded-lg bg-surface2 border border-border flex items-center justify-center flex-shrink-0">
              <Icon :icon="catOf(a.category).icon" class="w-3.5 h-3.5 text-text-muted" />
            </div>
            <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(a)">
              <p class="text-sm font-medium truncate">{{ a.name }}</p>
              <p class="text-[11px] text-text-muted flex items-center gap-2 flex-wrap">
                <span>{{ catOf(a.category).label }}</span>
                <span v-if="a.quantity" class="flex items-center gap-1">
                  <Icon icon="lucide:hash" class="w-3 h-3" />{{ a.quantity }}
                </span>
                <span v-if="a.notes" class="truncate">{{ a.notes }}</span>
              </p>
            </div>
            <span class="text-sm font-semibold text-text flex-shrink-0">{{ eur(a.value) }}</span>
            <button @click.stop="pendingDelete = a.id"
              class="p-1.5 text-text-muted hover:text-rose transition-colors flex-shrink-0" aria-label="Supprimer">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div v-if="pendingDelete && g.items.some(x => x.id === pendingDelete)"
          class="flex items-center gap-2 bg-rose/5 border-t border-rose/20 px-4 py-2">
          <p class="text-xs flex-1">Supprimer cet actif ?</p>
          <button @click.stop="pendingDelete = null" class="px-3 py-1 rounded-lg border border-border text-xs text-text-muted hover:bg-surface2 transition-colors">Annuler</button>
          <button @click.stop="removeAsset(pendingDelete)" class="px-3 py-1 rounded-lg bg-rose text-white text-xs font-semibold hover:bg-rose-soft transition-colors">Supprimer</button>
        </div>
      </div>
    </div>

    <!-- Modale actif -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-dark/80 backdrop-blur-sm" @click="showModal = false" />
          <div class="relative w-full sm:max-w-lg bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto pb-safe-lg">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
              <Icon icon="lucide:wallet" class="w-5 h-5 text-gold" />
              {{ editing ? "Modifier l'actif" : 'Ajouter un actif' }}
            </h3>

            <form @submit.prevent="onSubmit" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Quoi *</label>
                <input v-model="form.name" required placeholder="Bitcoin, PEA, Studio Lyon..."
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">À qui</label>
                <div class="flex gap-2">
                  <button v-for="o in OWNERS" :key="String(o.id)" type="button" @click="form.owner_id = o.id"
                    class="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center justify-center gap-2"
                    :class="form.owner_id === o.id ? 'bg-surface2 border-gold/40 text-text' : 'bg-surface2/50 border-border text-text-muted hover:text-text'">
                    <span class="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold text-white" :style="{ background: o.color }">{{ o.name.charAt(0) }}</span>
                    {{ o.name }}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Type</label>
                  <select v-model="form.category" class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50">
                    <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-muted mb-1">Valeur (€)</label>
                  <input v-model="form.value" type="number" min="0" step="50"
                    class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Quantité <span class="text-text-muted/70">(optionnel : 0,5 BTC, 12 parts...)</span></label>
                <input v-model="form.quantity" type="number" min="0" step="any" placeholder="0.5"
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors" />
              </div>

              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">Notes</label>
                <textarea v-model="form.notes" rows="2" placeholder="Prix de revient, échéance, plateforme..."
                  class="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none focus:border-gold/50 transition-colors resize-none" />
              </div>

              <div class="flex gap-3 pt-2">
                <button type="button" @click="showModal = false"
                  class="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm hover:bg-surface2 transition-colors">Annuler</button>
                <button type="submit" :disabled="saving"
                  class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-semibold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
                  <Icon :icon="saving ? 'lucide:loader-circle' : (editing ? 'lucide:save' : 'lucide:plus')"
                    class="w-4 h-4" :class="{ 'animate-spin': saving }" />
                  {{ editing ? 'Enregistrer' : 'Ajouter' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
</style>
