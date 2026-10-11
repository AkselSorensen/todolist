// Catalogue d'affichage des dépenses : libellés, icônes, couleurs, regroupement
// par bucket. Le serveur a son propre catalogue (validation + repère 50/30/20) ;
// ici c'est la couche présentation — elle seule décide d'une icône et d'une couleur.

export const EXPENSE_BUCKETS = [
  { key: 'income', label: 'Revenus', short: 'Revenus', icon: 'lucide:arrow-down-left', color: '#6fcf97' },
  { key: 'fixed', label: 'Charges fixes', short: 'Fixes', icon: 'lucide:house', color: '#ff6b8a' },
  { key: 'variable', label: 'Dépenses variables', short: 'Variable', icon: 'lucide:shopping-cart', color: '#a78bfa' },
  { key: 'travel', label: 'Voyages', short: 'Voyage', icon: 'lucide:plane', color: '#f0c060' },
  { key: 'savings', label: 'Argent de côté', short: 'Épargne', icon: 'lucide:piggy-bank', color: '#4adec0' },
  { key: 'investment', label: 'Investissement', short: 'Invest.', icon: 'lucide:trending-up', color: '#4da6ff' },
]

export const EXPENSE_CATS = [
  { key: 'loyer', label: 'Loyer / crédit immo', bucket: 'fixed', icon: 'lucide:house', color: '#ff6b8a' },
  { key: 'charges', label: 'Charges & énergie', bucket: 'fixed', icon: 'lucide:zap', color: '#ff8f6b' },
  { key: 'abonnements', label: 'Abonnements', bucket: 'fixed', icon: 'lucide:repeat', color: '#e0718f' },
  { key: 'assurances', label: 'Assurances', bucket: 'fixed', icon: 'lucide:shield', color: '#c76a9e' },
  { key: 'credits', label: 'Crédits & prêts', bucket: 'fixed', icon: 'lucide:landmark', color: '#b06bd0' },
  { key: 'impots', label: 'Impôts & taxes', bucket: 'fixed', icon: 'lucide:file-text', color: '#9a86b8' },
  { key: 'courses', label: 'Courses', bucket: 'variable', icon: 'lucide:shopping-cart', color: '#4adec0' },
  { key: 'transport', label: 'Transport', bucket: 'variable', icon: 'lucide:car', color: '#4da6ff' },
  { key: 'sante', label: 'Santé', bucket: 'variable', icon: 'lucide:heart-pulse', color: '#6fcf97' },
  { key: 'maison', label: 'Maison & travaux', bucket: 'variable', icon: 'lucide:wrench', color: '#7fb8d0' },
  { key: 'loisirs', label: 'Loisirs', bucket: 'variable', icon: 'lucide:ticket', color: '#a78bfa' },
  { key: 'resto', label: 'Restos & sorties', bucket: 'variable', icon: 'lucide:utensils', color: '#f0c060' },
  { key: 'shopping', label: 'Shopping', bucket: 'variable', icon: 'lucide:shopping-bag', color: '#ff9f7a' },
  { key: 'cadeaux', label: 'Cadeaux', bucket: 'variable', icon: 'lucide:gift', color: '#ff7aa8' },
  { key: 'autre', label: 'Autre dépense', bucket: 'variable', icon: 'lucide:package', color: '#8888a0' },
  { key: 'voyage', label: 'Voyage', bucket: 'travel', icon: 'lucide:plane', color: '#f0c060' },
  { key: 'epargne', label: 'Argent de côté', bucket: 'savings', icon: 'lucide:piggy-bank', color: '#4adec0' },
  { key: 'investissement', label: 'Investissement', bucket: 'investment', icon: 'lucide:trending-up', color: '#4da6ff' },
  { key: 'salaire', label: 'Salaire', bucket: 'income', icon: 'lucide:banknote', color: '#6fcf97' },
  { key: 'freelance', label: 'Freelance & missions', bucket: 'income', icon: 'lucide:laptop', color: '#4adec0' },
  { key: 'locatif', label: 'Revenus locatifs', bucket: 'income', icon: 'lucide:building-2', color: '#4da6ff' },
  { key: 'aides', label: 'Aides & primes', bucket: 'income', icon: 'lucide:hand-coins', color: '#a8d66f' },
  { key: 'autres_revenus', label: 'Autres revenus', bucket: 'income', icon: 'lucide:plus-circle', color: '#8fd0a8' },
]
