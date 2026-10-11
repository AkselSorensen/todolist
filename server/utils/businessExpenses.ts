import { query } from './db'

// Gestion des dépenses du couple : ce qui rentre, ce qui sort, ce qu'on met de côté
// et ce qu'on investit. Auto-créée, migrations additives — même convention que les
// autres tables Business.
//
// Une ligne = un mouvement. `bucket` est la classe de calcul (revenu, charge fixe,
// variable, voyage, épargne, investissement) ; `category` est le libellé métier qui
// la détermine. Le bucket est stocké pour que les agrégats SQL restent lisibles et
// qu'un historique ne change pas de sens si le catalogue évolue.
let ready: Promise<void> | null = null

async function create() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_expenses (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      owner_id INT REFERENCES accounts(id),
      created_by INT REFERENCES accounts(id),
      label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'autre',
      bucket TEXT NOT NULL DEFAULT 'variable',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
      month DATE GENERATED ALWAYS AS (date_trunc('month', spent_on::timestamp)::date) STORED,
      payment TEXT NOT NULL DEFAULT 'cb',
      recurring BOOLEAN NOT NULL DEFAULT false,
      recur_day INT,
      notes TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // migration additive : la colonne month est générée, elle ne peut pas être ajoutée
  // après coup sans réécrire la table -> on ajoute les colonnes ajoutables.
  await query(`ALTER TABLE business_expenses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`)
  await query(`ALTER TABLE business_expenses ADD COLUMN IF NOT EXISTS recur_day INT`)
  await query(`CREATE INDEX IF NOT EXISTS business_expenses_partnership_month_idx ON business_expenses (partnership_id, month)`)
  await query(`CREATE INDEX IF NOT EXISTS business_expenses_partnership_owner_idx ON business_expenses (partnership_id, owner_id)`)
  // Filet de sécurité : une seule ligne automatique par (personne, libellé, catégorie, mois)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS business_expenses_auto_uniq
      ON business_expenses (partnership_id, COALESCE(owner_id, 0), label, category, month)
      WHERE source = 'auto'
  `)

  // Plafonds mensuels par catégorie : sert au conseil « tu dépasses de X € ».
  await query(`
    CREATE TABLE IF NOT EXISTS business_expense_budgets (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      category TEXT NOT NULL,
      monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_by INT REFERENCES accounts(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (partnership_id, category)
    )
  `)
}

export function ensureBusinessExpensesTable() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e })
  return ready
}

/* ------------------------------------------------------------------ catalogue */

// needs = fait partie des « besoins » au sens 50/30/20 (le reste = envies).
export const EXPENSE_CATEGORIES = [
  { key: 'loyer', label: 'Loyer / crédit immo', bucket: 'fixed', needs: true },
  { key: 'charges', label: 'Charges & énergie', bucket: 'fixed', needs: true },
  { key: 'abonnements', label: 'Abonnements', bucket: 'fixed', needs: true },
  { key: 'assurances', label: 'Assurances', bucket: 'fixed', needs: true },
  { key: 'credits', label: 'Crédits & prêts', bucket: 'fixed', needs: true },
  { key: 'impots', label: 'Impôts & taxes', bucket: 'fixed', needs: true },
  { key: 'courses', label: 'Courses', bucket: 'variable', needs: true },
  { key: 'transport', label: 'Transport', bucket: 'variable', needs: true },
  { key: 'sante', label: 'Santé', bucket: 'variable', needs: true },
  { key: 'maison', label: 'Maison & travaux', bucket: 'variable', needs: true },
  { key: 'loisirs', label: 'Loisirs', bucket: 'variable', needs: false },
  { key: 'resto', label: 'Restos & sorties', bucket: 'variable', needs: false },
  { key: 'shopping', label: 'Shopping', bucket: 'variable', needs: false },
  { key: 'cadeaux', label: 'Cadeaux', bucket: 'variable', needs: false },
  { key: 'voyage', label: 'Voyage', bucket: 'travel', needs: false },
  { key: 'epargne', label: 'Argent de côté', bucket: 'savings', needs: false },
  { key: 'investissement', label: 'Investissement', bucket: 'investment', needs: false },
  { key: 'autre', label: 'Autre', bucket: 'variable', needs: false },
  { key: 'salaire', label: 'Salaire', bucket: 'income', needs: false },
  { key: 'freelance', label: 'Freelance & missions', bucket: 'income', needs: false },
  { key: 'locatif', label: 'Revenus locatifs', bucket: 'income', needs: false },
  { key: 'aides', label: 'Aides & primes', bucket: 'income', needs: false },
  { key: 'autres_revenus', label: 'Autres revenus', bucket: 'income', needs: false },
] as const

export const EXPENSE_BUCKETS = ['income', 'fixed', 'variable', 'travel', 'savings', 'investment'] as const
export const EXPENSE_PAYMENTS = ['cb', 'virement', 'prelevement', 'especes', 'cheque'] as const

export const categoryDef = (key: string) =>
  EXPENSE_CATEGORIES.find(c => c.key === key) || EXPENSE_CATEGORIES.find(c => c.key === 'autre')!

// Le bucket n'est jamais saisi : il découle de la catégorie.
export const bucketOf = (category: string) => categoryDef(category).bucket

export const EXPENSE_FIELDS = ['label', 'category', 'amount', 'spent_on', 'payment', 'recurring', 'recur_day', 'notes', 'owner_id']

/* ------------------------------------------------- charges récurrentes (auto) */

// Matérialise les charges récurrentes du mois courant à partir du dernier montant
// connu (mois précédents). Idempotent : ON CONFLICT + anti-jointure, et on ne
// remplit jamais un mois passé — on ne fabrique pas de données qu'on n'a pas vues.
export async function materializeRecurring(partnershipId: number) {
  const r = await query(`
    WITH tpl AS (
      SELECT DISTINCT ON (e.label, COALESCE(e.owner_id, 0), e.category)
             e.label, e.category, e.bucket, e.amount, e.owner_id, e.created_by,
             e.payment, COALESCE(e.recur_day, 1) AS recur_day, e.notes
      FROM business_expenses e
      WHERE e.partnership_id = $1
        AND e.recurring = true
        AND e.month < date_trunc('month', NOW())::date
      ORDER BY e.label, COALESCE(e.owner_id, 0), e.category, e.month DESC, e.id DESC
    )
    INSERT INTO business_expenses
      (partnership_id, owner_id, created_by, label, category, bucket, amount,
       spent_on, payment, recurring, recur_day, notes, source)
    SELECT $1, t.owner_id, t.created_by, t.label, t.category, t.bucket, t.amount,
           (date_trunc('month', NOW())::date + (LEAST(GREATEST(t.recur_day, 1), 28) - 1)),
           t.payment, true, t.recur_day, t.notes, 'auto'
    FROM tpl t
    WHERE NOT EXISTS (
      SELECT 1 FROM business_expenses x
      WHERE x.partnership_id = $1
        AND x.label = t.label
        AND x.category = t.category
        AND COALESCE(x.owner_id, 0) = COALESCE(t.owner_id, 0)
        AND x.month = date_trunc('month', NOW())::date
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [partnershipId])
  return r.rowCount || 0
}

/* --------------------------------------------------------------- agrégats SQL */

const MONTH_FLOOR = `e.month >= (date_trunc('month', NOW()) - ($2 || ' months')::interval)::date`

// Une ligne par mois sur la période demandée + le montant d'un mois vide = absent
// (rempli à 0 par le calcul, pour que la courbe reste continue).
export const MONTHLY_SQL = `
  SELECT to_char(e.month, 'YYYY-MM') AS month,
         COALESCE(SUM(CASE WHEN e.bucket = 'income' THEN e.amount END), 0)::float8 AS income,
         COALESCE(SUM(CASE WHEN e.bucket = 'fixed' THEN e.amount END), 0)::float8 AS fixed,
         COALESCE(SUM(CASE WHEN e.bucket = 'variable' THEN e.amount END), 0)::float8 AS variable,
         COALESCE(SUM(CASE WHEN e.bucket = 'travel' THEN e.amount END), 0)::float8 AS travel,
         COALESCE(SUM(CASE WHEN e.bucket = 'savings' THEN e.amount END), 0)::float8 AS savings,
         COALESCE(SUM(CASE WHEN e.bucket = 'investment' THEN e.amount END), 0)::float8 AS investment,
         COUNT(*)::int AS entries
  FROM business_expenses e
  WHERE e.partnership_id = $1 AND ${MONTH_FLOOR}
  GROUP BY e.month
  ORDER BY e.month ASC
`

// Par catégorie : le mois courant (current) et le cumul de la période (total).
export const CATEGORY_SQL = `
  SELECT e.category, e.bucket,
         COALESCE(SUM(CASE WHEN e.month = date_trunc('month', NOW())::date THEN e.amount END), 0)::float8 AS current,
         COALESCE(SUM(e.amount), 0)::float8 AS total,
         COUNT(*)::int AS count,
         COUNT(DISTINCT e.month)::int AS months
  FROM business_expenses e
  WHERE e.partnership_id = $1 AND ${MONTH_FLOOR}
  GROUP BY e.category, e.bucket
  ORDER BY total DESC
`

export const OWNER_SQL = `
  SELECT COALESCE(e.owner_id, 0) AS owner_id,
         o.name AS owner_name, o.color AS owner_color,
         COALESCE(SUM(CASE WHEN e.bucket = 'income' THEN e.amount END), 0)::float8 AS income,
         COALESCE(SUM(CASE WHEN e.bucket IN ('fixed', 'variable', 'travel') THEN e.amount END), 0)::float8 AS expense,
         COALESCE(SUM(CASE WHEN e.bucket IN ('savings', 'investment') THEN e.amount END), 0)::float8 AS saved,
         COUNT(*)::int AS entries
  FROM business_expenses e
  LEFT JOIN accounts o ON e.owner_id = o.id
  WHERE e.partnership_id = $1 AND e.month = date_trunc('month', NOW())::date
  GROUP BY COALESCE(e.owner_id, 0), o.name, o.color
  ORDER BY expense DESC
`

// Charges récurrentes : le dernier montant connu de chaque ligne (pas une par mois)
export const RECURRING_SQL = `
  SELECT DISTINCT ON (e.label, COALESCE(e.owner_id, 0), e.category)
         e.id, e.label, e.category, e.bucket, e.amount::float8 AS amount, e.owner_id,
         e.payment, COALESCE(e.recur_day, 1) AS recur_day, e.notes
  FROM business_expenses e
  WHERE e.partnership_id = $1 AND e.recurring = true
  ORDER BY e.label, COALESCE(e.owner_id, 0), e.category, e.month DESC, e.id DESC
`

// Mois pour lesquels il existe au moins une saisie (sélecteur de mois)
export const MONTHS_SQL = `
  SELECT DISTINCT to_char(e.month, 'YYYY-MM') AS month
  FROM business_expenses e
  WHERE e.partnership_id = $1
  ORDER BY month DESC
  LIMIT 24
`

export const EXPENSE_ROW_SQL = `
  SELECT e.id, e.label, e.category, e.bucket, e.amount::float8 AS amount,
         to_char(e.spent_on, 'YYYY-MM-DD') AS spent_on, e.payment, e.recurring,
         e.recur_day, e.notes, e.source, e.owner_id,
         o.name AS owner_name, o.color AS owner_color
  FROM business_expenses e
  LEFT JOIN accounts o ON e.owner_id = o.id
`

export const EXPENSE_ROW_MONEY_PLAIN = `
  id, label, category, bucket, amount::float8 AS amount,
  to_char(spent_on, 'YYYY-MM-DD') AS spent_on, payment, recurring, recur_day,
  notes, source, owner_id
`

/* ------------------------------------------------- analyse (fonctions pures) */

// Toutes les entrées viennent de la base, la sortie est du JSON prêt à afficher.
// Aucune requête ici : c'est testable avec des données fabriquées.
const money = (n: any) => Math.round((Number(n) || 0) * 100) / 100
const round2 = money
const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0)
const median = (vals: number[]) => {
  const v = vals.filter(x => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return 0
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null)
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
// 1 quand on est au mieux, 0 quand on est au pire, linéaire entre les deux bornes
const scale = (x: number, best: number, worst: number) => {
  if (worst === best) return 1
  return clamp((worst - x) / (worst - best), 0, 1)
}
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10))
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()

export function buildReport(input: any, opts?: { months?: number; today?: string }) {
  const months = Math.max(1, Number(opts?.months) || 6)
  const today = opts?.today || new Date().toISOString().slice(0, 10)
  const curKey = today.slice(0, 7)

  const rawMonthly: any[] = input?.monthly || []
  const byMonth = new Map<string, any>(rawMonthly.map((r: any) => [r.month, r]))
  // Squelette continu : tous les mois de la fenêtre, même ceux sans saisie
  const keys: string[] = []
  const [ty, tm] = curKey.split('-').map(Number)
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ty, tm - 1 - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthly = keys.map((k) => {
    const r = byMonth.get(k)
    const income = money(r?.income), fixed = money(r?.fixed), variable = money(r?.variable)
    const travel = money(r?.travel), savings = money(r?.savings), investment = money(r?.investment)
    const expense = money(fixed + variable + travel)
    const saved = money(savings + investment)
    return {
      month: k, label: monthLabel(k),
      income, fixed, variable, travel, savings, investment, expense, saved,
      cash: money(income - expense),
      balance: money(income - expense - saved),
      savedRate: ratio(saved, income),
      entries: Number(r?.entries) || 0,
    }
  })

  const cur = monthly[monthly.length - 1]
  const prevIncome = monthly.slice(0, -1).map(m => m.income).filter(v => v > 0)
  // Revenu de référence : le mois courant s'il est renseigné, sinon la médiane de la
  // période (un salaire manquant un mois ne doit pas fausser tous les ratios).
  const incomeRef = cur.income > 0 ? cur.income : median(prevIncome)
  const hasIncome = incomeRef > 0

  const prev = monthly.slice(0, -1)
  const expenseWithData = prev.filter(m => m.expense > 0 || m.entries > 0)
  const avgExpensePrev = expenseWithData.length ? sum(expenseWithData, m => m.expense) / expenseWithData.length : 0
  const prevMonth = monthly.length >= 2 ? monthly[monthly.length - 2] : null

  // Rythme du mois en cours : projection seulement si on a assez de jours écoulés
  const elapsed = dayOfMonth(today)
  const dInMonth = daysInMonth(ty, tm)
  const perDay = cur.expense > 0 ? cur.expense / Math.max(1, elapsed) : 0
  const projectedExpense = elapsed >= 5 && cur.expense > 0 ? money(perDay * dInMonth) : null

  const categories: any[] = (input?.categories || []).map((c: any) => {
    const def = categoryDef(c.category)
    const otherMonths = Math.max(0, (Number(c.months) || 0) - (c.current > 0 ? 1 : 0))
    const avgOther = otherMonths > 0 ? (Number(c.total) - Number(c.current)) / otherMonths : 0
    const trend = (Number(c.months) >= 3 && avgOther > 0) ? (Number(c.current) / avgOther) - 1 : null
    return {
      category: c.category, bucket: c.bucket, label: def.label, needs: def.needs,
      current: money(c.current), total: money(c.total), count: Number(c.count) || 0,
      months: Number(c.months) || 0, avgOther: money(avgOther), trend,
    }
  }).sort((a: any, b: any) => b.current - a.current)

  const expenseCats = categories.filter(c => ['fixed', 'variable', 'travel'].includes(c.bucket))
  const needsNow = sum(categories.filter(c => c.needs && ['fixed', 'variable'].includes(c.bucket)), c => c.current)
  const wantsNow = sum(categories.filter(c => !c.needs && ['variable', 'travel'].includes(c.bucket)), c => c.current)

  const owners: any[] = (input?.owners || []).map((o: any) => ({
    owner_id: Number(o.owner_id) || 0,
    name: o.owner_name || 'Nous deux',
    color: o.owner_color || '#f0c060',
    income: money(o.income), expense: money(o.expense), saved: money(o.saved),
    balance: money(Number(o.income) - Number(o.expense) - Number(o.saved)),
    entries: Number(o.entries) || 0,
  }))
  const declaredExpense = sum(owners, o => o.expense)

  const recurringRows: any[] = (input?.recurring || []).map((r: any) => ({
    ...r, amount: money(r.amount), label_cat: categoryDef(r.category).label,
    shared: !r.owner_id,
  }))
  const recurringTotal = sum(recurringRows.filter(r => ['fixed', 'variable'].includes(r.bucket)), r => r.amount)
  const recurringIncome = sum(recurringRows.filter(r => r.bucket === 'income'), r => r.amount)

  const budgets: any[] = (input?.budgets || []).map((b: any) => {
    const cat = categories.find(c => c.category === b.category)
    const spent = cat ? cat.current : 0
    const cap = money(b.monthly_amount)
    return {
      id: b.id, category: b.category, label: categoryDef(b.category).label, bucket: categoryDef(b.category).bucket,
      budget: cap, spent, pct: cap > 0 ? (spent / cap) * 100 : null,
      over: cap > 0 ? money(Math.max(0, spent - cap)) : 0,
    }
  }).sort((a: any, b: any) => (b.pct ?? 0) - (a.pct ?? 0))

  const savingsAssets = money(input?.assets?.savings)
  const assetsTotal = money(input?.assets?.total)
  const monthlyFixedRef = money(recurringTotal || cur.fixed)
  const coverageMonths = monthlyFixedRef > 0 ? savingsAssets / monthlyFixedRef : null
  const emergencyTarget = money(monthlyFixedRef * 3)

  const kpis = {
    income: cur.income, incomeRef: money(incomeRef), hasIncome,
    expense: cur.expense, fixed: cur.fixed, variable: cur.variable, travel: cur.travel,
    savings: cur.savings, investment: cur.investment, saved: cur.saved,
    cash: cur.cash, balance: cur.balance,
    savedRate: hasIncome ? ratio(cur.saved, incomeRef) : null,
    fixedRatio: hasIncome ? ratio(cur.fixed, incomeRef) : null,
    lifestyleRatio: hasIncome ? ratio(cur.variable + cur.travel, incomeRef) : null,
    needs: money(needsNow), wants: money(wantsNow),
    needsRatio: hasIncome ? ratio(needsNow, incomeRef) : null,
    wantsRatio: hasIncome ? ratio(wantsNow, incomeRef) : null,
    perDay: money(perDay), projectedExpense,
    avgExpensePrev: money(avgExpensePrev),
    expenseDeltaPct: avgExpensePrev > 0 ? ((cur.expense / avgExpensePrev) - 1) * 100 : null,
    prevExpense: prevMonth ? prevMonth.expense : null,
    prevDeltaPct: prevMonth && prevMonth.expense > 0 ? ((cur.expense / prevMonth.expense) - 1) * 100 : null,
    entries: cur.entries,
    entriesPeriod: sum(monthly, m => m.entries),
    monthsWithData: monthly.filter(m => m.entries > 0).length,
    elapsed, daysInMonth: dInMonth,
  }

  /* ------------------------------------------------------------- score /100 */

  const dimensions: any[] = []
  if (hasIncome) {
    const r = cur.saved / incomeRef
    dimensions.push({
      key: 'savings', label: 'Taux d\u2019épargne', max: 20,
      points: round2(scale(r, 0.20, 0) * 20),
      value: r * 100,
      detail: `${Math.round(r * 100)} % du revenu mis de côté (épargne + investissement)`,
      target: '20 % et plus = 20/20',
    })
    const f = cur.fixed / incomeRef
    dimensions.push({
      key: 'fixed', label: 'Poids des charges fixes', max: 20,
      points: round2(scale(f, 0.35, 0.55) * 20),
      value: f * 100,
      detail: `${Math.round(f * 100)} % du revenu part en charges fixes`,
      target: '35 % et moins = 20/20',
    })
    const l = (cur.variable + cur.travel) / incomeRef
    dimensions.push({
      key: 'lifestyle', label: 'Poids du variable & voyages', max: 20,
      points: round2(scale(l, 0.30, 0.45) * 20),
      value: l * 100,
      detail: `${Math.round(l * 100)} % du revenu en dépenses variables et voyages`,
      target: '30 % et moins = 20/20',
    })
  }
  const budgeted = budgets.filter(b => b.budget > 0)
  const overCount = budgeted.filter(b => b.over > 0).length
  dimensions.push({
    key: 'budgets', label: 'Plafonds respectés', max: 20,
    points: budgeted.length === 0 ? 10 : round2(((budgeted.length - overCount) / budgeted.length) * 20),
    value: budgeted.length ? ((budgeted.length - overCount) / budgeted.length) * 100 : null,
    detail: budgeted.length === 0
      ? 'Aucun plafond défini — 10/20 par défaut'
      : `${budgeted.length - overCount}/${budgeted.length} catégories sous leur plafond`,
    target: 'Toutes les catégories sous plafond = 20/20',
  })
  dimensions.push({
    key: 'cushion', label: 'Fonds d\u2019urgence', max: 20,
    points: coverageMonths === null ? 0 : round2(scale(coverageMonths, 3, 0) * 20),
    value: coverageMonths === null ? null : coverageMonths,
    detail: coverageMonths === null
      ? 'Renseigne ton épargne (onglet Patrimoine) pour la calculer'
      : `${coverageMonths.toFixed(1)} mois de charges fixes couverts`,
    target: '3 mois couverts = 20/20',
  })
  const scoreTotal = round2(sum(dimensions, d => d.points))
  const scoreLabel = scoreTotal >= 80 ? 'Excellente' : scoreTotal >= 60 ? 'Solide' : scoreTotal >= 40 ? 'Fragile' : 'À corriger'
  const score = {
    total: scoreTotal,
    // le max varie (les 3 premiers critères dépendent des revenus) -> on ramène sur 100
    max: sum(dimensions, d => d.max),
    on100: round2((scoreTotal / Math.max(1, sum(dimensions, d => d.max))) * 100),
    label: scoreLabel,
    dimensions,
  }

  /* --------------------------------------------------------------- conseils */

  const insights: any[] = []
  const push = (severity: string, icon: string, title: string, text: string) => insights.push({ severity, icon, title, text })
  const pctTxt = (n: number) => `${Math.round(n)} %`
  const money0 = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0))

  if (kpis.entriesPeriod === 0) {
    push('info', 'lucide:clipboard-list', 'Commence par tes charges fixes',
      'Saisis ton loyer, tes charges et tes revenus : les plafonds mensuels recréent ensuite ces lignes automatiquement chaque mois.')
  } else {
    if (!hasIncome) {
      push('warn', 'lucide:wallet', 'Aucun revenu saisi',
        'Sans revenus déclarés, impossible de calculer ton taux d\u2019épargne ni le poids de tes charges. Ajoute ton salaire (catégorie Salaire, récurrence mensuelle).')
    } else {
      const rate = cur.saved / incomeRef
      const gap20 = money0(Math.max(0, incomeRef * 0.2 - cur.saved))
      if (rate >= 0.2) {
        push('ok', 'lucide:piggy-bank', `Épargne solide : ${pctTxt(rate * 100)} du revenu`,
          `${money0(cur.saved)} mis de côté ce mois (${money0(cur.savings)} d\u2019épargne + ${money0(cur.investment)} d\u2019investissement) sur ${money0(incomeRef)} de revenus. Tu es au-dessus de la cible de 20 %.`)
      } else if (rate >= 0.1) {
        push('info', 'lucide:piggy-bank', `Épargne correcte : ${pctTxt(rate * 100)}`,
          `${money0(cur.saved)} mis de côté ce mois. Il manque ${gap20} pour atteindre 20 % du revenu — le levier le plus simple est ${money0(incomeRef * 0.1)}/mois de moins sur le variable.`)
      } else if (rate > 0) {
        push('warn', 'lucide:piggy-bank', `Épargne faible : ${pctTxt(rate * 100)}`,
          `${money0(cur.saved)} sur ${money0(incomeRef)} de revenus. Objectif minimum : 10 %, cible 20 % (${money0(incomeRef * 0.2)}/mois, soit ${gap20} de plus).`)
      } else {
        push('alert', 'lucide:circle-alert', 'Rien mis de côté ce mois',
          `Aucune ligne épargne ni investissement sur ${money0(incomeRef)} de revenus. Commence petit : un virement automatique de ${money0(incomeRef * 0.05)} (5 %) le lendemain de la paie.`)
      }

      const f = cur.fixed / incomeRef
      if (f > 0.5) {
        push('alert', 'lucide:house', `Charges fixes à ${pctTxt(f * 100)} du revenu`,
          `${money0(cur.fixed)}/mois partent avant toute dépense choisie (recommandé : 35 % max, soit ${money0(incomeRef * 0.35)}). Une renégociation d\u2019assurance ou de crédit est le seul levier rapide sur ce poste.`)
      } else if (f > 0.35) {
        push('info', 'lucide:house', `Charges fixes à ${pctTxt(f * 100)} du revenu`,
          `${money0(cur.fixed)}/mois. Au-dessus des 35 % conseillés : tu restes exposé si un revenu s\u2019arrête. Le loyer seul pèse ${pctTxt(((categories.find(c => c.category === 'loyer')?.current || 0) / incomeRef) * 100)} du revenu.`)
      } else if (kpis.entries >= 3) {
        push('ok', 'lucide:house', `Charges fixes maîtrisées : ${pctTxt(f * 100)}`,
          `${money0(cur.fixed)}/mois de charges fixes, sous la barre des 35 %. C\u2019est ce qui te laisse investir sans stress.`)
      }

      const needsPct = (needsNow / incomeRef) * 100
      const wantsPct = (wantsNow / incomeRef) * 100
      const savedPct = rate * 100
      if (wantsPct > 40) {
        const top = categories.filter(c => !c.needs && ['variable', 'travel'].includes(c.bucket)).sort((a, b) => b.current - a.current)[0]
        push('warn', 'lucide:party-popper', `Envies à ${pctTxt(wantsPct)} du revenu`,
          `Repère 50 / 30 / 20 : tu es à ${pctTxt(needsPct)} besoins / ${pctTxt(wantsPct)} envies / ${pctTxt(savedPct)} épargne.${top ? ` Le poste qui pèse : ${top.label} (${money0(top.current)}).` : ''} Ramener les envies à 30 % libère ${money0((wantsNow - incomeRef * 0.3))}/mois.`)
      } else if (kpis.entries >= 3) {
        push('ok', 'lucide:scale', `Répartition ${pctTxt(needsPct)} / ${pctTxt(wantsPct)} / ${pctTxt(savedPct)}`,
          `Besoins, envies et épargne sont globalement alignés sur le repère 50 / 30 / 20. Bon équilibre.`)
      }
    }

    // Déficit / sur-épargne : deux problèmes différents, deux messages différents
    if (hasIncome && cur.cash < 0) {
      push('alert', 'lucide:triangle-alert', `Déficit de ${money0(-cur.cash)} ce mois`,
        `Dépenses (${money0(cur.expense)}) au-dessus des revenus (${money0(cur.income)}) : la différence sort forcément du patrimoine existant${savingsAssets > 0 ? ` (${money0(savingsAssets)} d\u2019épargne disponible)` : ''}. Priorité : baisser le variable ou étaler les grosses dépenses.`)
    } else if (hasIncome && cur.cash >= 0 && cur.saved > cur.cash) {
      push('warn', 'lucide:arrow-left-right', 'Tu épargnes plus que ton solde disponible',
        `Solde du mois ${money0(cur.cash)}, mais ${money0(cur.saved)} mis de côté : le complément vient du patrimoine existant. À surveiller si ça se répète.`)
    }

    // Voyage : provisionner plutôt que casser l'épargne le mois du départ
    const travel = categories.find(c => c.bucket === 'travel')
    if (travel && travel.total > 0) {
      const perMonthProvision = travel.total / months
      push('info', 'lucide:plane', `Voyages : ${money0(travel.total)} sur ${months} mois`,
        `Soit ${money0(perMonthProvision)}/mois en moyenne. Le plus lisible : une ligne « Voyage » de ${money0(perMonthProvision)} mise de côté chaque mois, et tu utilises cette cagnotte quand tu réserves.`)
    }

    // Épargne qui dort / priorité fonds d'urgence
    if (coverageMonths !== null && coverageMonths < 3) {
      push('warn', 'lucide:shield-alert', `Fonds d\u2019urgence : ${coverageMonths.toFixed(1)} mois couverts`,
        `${money0(savingsAssets)} d\u2019épargne pour ${money0(monthlyFixedRef)}/mois de charges fixes. Vise ${money0(emergencyTarget)} (3 mois) avant d\u2019augmenter l\u2019investissement : c\u2019est ce qui évite de vendre au mauvais moment.`)
    } else if (coverageMonths !== null && coverageMonths >= 3 && cur.investment === 0) {
      push('info', 'lucide:trending-up', 'Fonds d\u2019urgence couvert — place le surplus',
        `${coverageMonths.toFixed(1)} mois de charges couverts et ${money0(cur.savings)} d\u2019épargne ce mois pour 0 € investi. Au-delà du matelas de sécurité, l\u2019épargne non investie perd du terrain face à l\u2019inflation.`)
    }

    // Dépassements de plafond
    const over = budgeted.filter(b => b.over > 0).sort((a, b) => b.over - a.over)
    for (const b of over.slice(0, 3)) {
      push(b.over > b.budget * 0.25 ? 'alert' : 'warn', 'lucide:gauge', `${b.label} : +${money0(b.over)} au-delà du plafond`,
        `${money0(b.spent)} dépensés pour ${money0(b.budget)} prévus (${Math.round(b.pct)} %). Soit ${money0(b.over)} à récupérer ailleurs ou un plafond à ajuster à la réalité.`)
    }
    if (budgeted.length === 0) {
      push('info', 'lucide:target', 'Définis 3 ou 4 plafonds',
        'Un plafond mensuel par catégorie (loisirs, restos, courses, voyage) transforme le suivi en alerte. Commence par les postes où tu as le plus de marge.')
    }

    // Dérive d'une catégorie par rapport à son historique
    const spikes = categories
      .filter(c => c.trend !== null && c.trend >= 0.3 && c.current >= 50 && ['fixed', 'variable', 'travel'].includes(c.bucket))
      .sort((a, b) => b.trend - a.trend)
    for (const s of spikes.slice(0, 2)) {
      push('warn', 'lucide:trending-up', `${s.label} en hausse de ${Math.round(s.trend * 100)} %`,
        `${money0(s.current)} ce mois contre ${money0(s.avgOther)}/mois en moyenne sur la période. Une hausse ponctuelle n\u2019est pas un problème ; trois mois de suite, si.`)
    }

    // Charges récurrentes : visibilité et doublons
    if (recurringRows.length > 0) {
      const share = hasIncome ? Math.round(ratio(recurringTotal, incomeRef) * 100) : null
      const subs = recurringRows.filter(r => r.category === 'abonnements').length
      push('info', 'lucide:repeat', `${recurringRows.length} lignes récurrentes = ${money0(recurringTotal)}/mois`,
        `Elles sont recréées automatiquement chaque mois${share !== null ? `, soit ${share} % de ton revenu` : ''}${recurringIncome > 0 ? ` (revenus récurrents : ${money0(recurringIncome)})` : ''}.${subs >= 4 ? ` Tu as ${subs} abonnements : un audit rapide de ce poste est souvent le gain le plus facile.` : ''}`)
    }

    // Pic global du mois
    if (kpis.expenseDeltaPct !== null && kpis.expenseDeltaPct >= 25 && cur.expense > 0) {
      const top = expenseCats[0]
      push('info', 'lucide:chart-column', `Dépenses +${Math.round(kpis.expenseDeltaPct)} % vs ta moyenne`,
        `${money0(cur.expense)} ce mois contre ${money0(avgExpensePrev)}/mois en moyenne sur la période${top ? `, porté par ${top.label} (${money0(top.current)})` : ''}.`)
    }
  }

  const order = { alert: 0, warn: 1, info: 2, ok: 3 } as Record<string, number>
  insights.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

  return {
    period: {
      months,
      from: monthly[0]?.month || curKey,
      to: curKey,
      label: `${monthLabel(monthly[0]?.month || curKey)} → ${monthLabel(curKey)}`,
    },
    month: curKey,
    kpis,
    monthly,
    categories,
    owners: { rows: owners, declaredExpense: money(declaredExpense) },
    budgets,
    recurring: { rows: recurringRows, total: money(recurringTotal), income: money(recurringIncome) },
    savings: {
      assetsSavings: savingsAssets, assetsTotal,
      monthlyFixedRef, coverageMonths: coverageMonths === null ? null : round2(coverageMonths),
      emergencyTarget,
    },
    score,
    insights,
  }
}
