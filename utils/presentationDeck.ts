// Transforme le bilan (sortie de /api/business-expenses/report) en une suite de
// diapositives. Fonction PURE : c'est la même liste qui sert à la page de
// présentation (affichage à l'écran) et à l'export PowerPoint — une seule vérité.
//
// kind: 'title' | 'kpis' | 'score' | 'chart' | 'table' | 'advice' | 'note'

const eur = (n: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
const pctOf = (n: any) => (n === null || n === undefined ? '—' : `${Math.round(Number(n) * 100)} %`)
const short = (m: string) => {
  const [y, mo] = String(m).split('-').map(Number)
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export const CHART_TYPES = ['bar', 'pie', 'rule', 'people'] as const

export function buildDeck(report: any, opts?: { people?: string }) {
  const r = report || {}
  const k = r.kpis || {}
  const period = r.period || {}
  const people = opts?.people || 'Aksel & Amandine'
  const slides: any[] = []

  slides.push({
    kind: 'title',
    title: 'Bilan de gestion',
    subtitle: `${people} · ${period.label || ''}`,
    meta: `${k.entriesPeriod || 0} saisie${(k.entriesPeriod || 0) > 1 ? 's' : ''} analysée${(k.entriesPeriod || 0) > 1 ? 's' : ''}`,
  })

  // Chiffres du mois
  slides.push({
    kind: 'kpis',
    title: 'Le mois en un coup d\u2019œil',
    items: [
      { label: 'Revenus', value: eur(k.incomeRef ?? k.income), color: '#6fcf97', icon: 'arrow-down-left' },
      { label: 'Dépenses', value: eur(k.expense), sub: `${eur(k.fixed)} fixes · ${eur(k.variable)} var.${k.travel ? ` · ${eur(k.travel)} voyage` : ''}`, color: '#ff6b8a', icon: 'receipt' },
      { label: 'Mis de côté', value: eur(k.saved), sub: `${eur(k.savings)} épargne · ${eur(k.investment)} invest.`, color: '#f0c060', icon: 'piggy-bank' },
      { label: 'Reste', value: eur(k.balance), sub: k.savedRate !== null ? `${pctOf(k.savedRate)} d\u2019épargne` : '', color: (k.balance ?? 0) >= 0 ? '#4adec0' : '#ff6b8a', icon: 'wallet' },
    ],
  })

  if (r.score) {
    slides.push({
      kind: 'score',
      title: 'Santé de gestion',
      total: r.score.total,
      max: r.score.max,
      label: r.score.label,
      dimensions: (r.score.dimensions || []).map((d: any) => ({
        label: d.label, points: d.points, max: d.max, detail: d.detail,
        color: d.points / d.max >= 0.8 ? '#4adec0' : d.points / d.max >= 0.5 ? '#f0c060' : '#ff6b8a',
      })),
    })
  }

  // Dépenses par mois (barres empilées) + revenus en clair
  const months = r.monthly || []
  if (months.length) {
    slides.push({
      kind: 'chart',
      chart: 'bar',
      title: 'Dépenses par mois',
      subtitle: 'Barres empilées : charges fixes, variable, voyage',
      stacked: true,
      series: [
        { name: 'Charges fixes', color: '#ff6b8a' },
        { name: 'Variable', color: '#a78bfa' },
        { name: 'Voyage', color: '#f0c060' },
      ],
      categories: months.map((m: any) => short(m.month)),
      values: [
        months.map((m: any) => Number(m.fixed) || 0),
        months.map((m: any) => Number(m.variable) || 0),
        months.map((m: any) => Number(m.travel) || 0),
      ],
      footer: 'Revenus du mois : ' + months.map((m: any) => `${short(m.month)} ${eur(m.income)}`).join(' · '),
    })
  }

  // Répartition du mois
  const cats = (r.categories || []).filter((c: any) => ['fixed', 'variable', 'travel'].includes(c.bucket) && c.current > 0)
  if (cats.length) {
    const top = cats.slice(0, 7)
    const rest = cats.slice(7).reduce((s: number, c: any) => s + c.current, 0)
    slides.push({
      kind: 'chart',
      chart: 'pie',
      title: 'Où part l\u2019argent ce mois',
      subtitle: `${eur(k.expense)} de dépenses`,
      series: [{ name: 'Dépenses', color: '#ff6b8a' }],
      categories: [...top.map((c: any) => c.label), ...(rest > 0 ? ['Autres'] : [])],
      values: [[...top.map((c: any) => c.current), ...(rest > 0 ? [Math.round(rest * 100) / 100] : [])]],
      colors: ['#ff6b8a', '#f0c060', '#4adec0', '#a78bfa', '#4da6ff', '#ff9f7a', '#7fb8d0', '#8888a0'],
    })
  }

  // Repère 50/30/20
  if (k.hasIncome) {
    slides.push({
      kind: 'chart',
      chart: 'rule',
      title: 'Repère 50 / 30 / 20',
      subtitle: `Sur ${eur(k.incomeRef)} de revenus mensuels`,
      rows: [
        { label: 'Besoins', real: k.needs ?? 0, target: (k.incomeRef || 0) * 0.5, color: '#4da6ff' },
        { label: 'Envies', real: k.wants ?? 0, target: (k.incomeRef || 0) * 0.3, color: '#a78bfa' },
        { label: 'Épargne', real: k.saved ?? 0, target: (k.incomeRef || 0) * 0.2, color: '#4adec0' },
      ],
    })
  }

  // Qui déclare quoi
  const owners = (r.owners?.rows || [])
  if (owners.length) {
    slides.push({
      kind: 'chart',
      chart: 'people',
      title: 'Qui déclare quoi',
      subtitle: 'Chaque ligne est rattachée à une personne ou au couple',
      rows: owners.map((o: any) => ({
        label: o.owner_id ? o.name : 'Nous deux',
        color: o.color || '#f0c060',
        values: [
          { label: 'Dépensé', value: o.expense },
          { label: 'Mis de côté', value: o.saved },
          { label: 'Revenus', value: o.income },
        ],
      })),
    })
  }

  // Conseils : une idée par diapositive
  const advices = (r.insights || []).slice(0, 6)
  advices.forEach((a: any, i: number) => {
    slides.push({
      kind: 'advice',
      title: a.title,
      text: a.text,
      severity: a.severity,
      step: `${i + 1}/${advices.length}`,
    })
  })

  // Charges récurrentes
  const rec = (r.recurring?.rows || [])
  if (rec.length) {
    slides.push({
      kind: 'table',
      title: 'Charges récurrentes',
      subtitle: `${eur(r.recurring.total)}/mois d\u2019engagements fixes`,
      head: ['Quoi', 'Catégorie', 'Jour', 'Montant'],
      rows: rec.map((x: any) => [x.label, x.label_cat, `le ${x.recur_day}`, eur(x.amount)]),
    })
  }

  // Plafonds
  const bud = (r.budgets || []).filter((b: any) => b.budget > 0)
  if (bud.length) {
    slides.push({
      kind: 'table',
      title: 'Plafonds mensuels',
      subtitle: 'Consommé sur le mois en cours',
      head: ['Poste', 'Plafond', 'Dépensé', 'État'],
      rows: bud.map((b: any) => [b.label, eur(b.budget), eur(b.spent), b.over > 0 ? `+${eur(b.over)} dépassé` : `${Math.round(b.pct)} %`]),
    })
  }

  // Fonds d'urgence / placement
  if (r.savings) {
    slides.push({
      kind: 'kpis',
      title: 'Matelas de sécurité',
      items: [
        { label: 'Épargne disponible', value: eur(r.savings.assetsSavings), color: '#4adec0', icon: 'piggy-bank' },
        { label: 'Charges fixes / mois', value: eur(r.savings.monthlyFixedRef), color: '#ff6b8a', icon: 'house' },
        { label: 'Couverture', value: r.savings.coverageMonths === null ? '—' : `${Number(r.savings.coverageMonths).toFixed(1)} mois`, sub: 'cible : 3 mois', color: '#f0c060', icon: 'shield' },
        { label: 'Objectif matelas', value: eur(r.savings.emergencyTarget), color: '#a78bfa', icon: 'target' },
      ],
    })
  }

  slides.push({
    kind: 'note',
    title: 'Méthode',
    text: `Bilan calculé sur ${period.months || 0} mois (${period.label || ''}), revenu de référence ${eur(k.incomeRef)}`
      + `${k.hasIncome ? '' : ' — non renseigné : les ratios et le score sont partiels'}. `
      + 'Épargne et investissement ne sont pas comptés comme des dépenses. '
      + 'Ce sont des repères de gestion, pas un conseil en investissement.',
  })

  return {
    title: 'Bilan de gestion',
    subtitle: `${people} · ${period.label || ''}`,
    month: r.month,
    slides,
  }
}
