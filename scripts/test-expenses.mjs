// Test d'intégration de la gestion des dépenses, sur un vrai serveur HTTP + un vrai
// Postgres (PGlite via socket). Vérifie les API (CRUD, récurrences, plafonds) puis
// les invariants du bilan (agrégats, score, conseils) — pas juste un « ça répond 200 ».
//
//   node scripts/dev-pglite.mjs                       (terminal 1)
//   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres npm run dev   (terminal 2)
//   node scripts/test-expenses.mjs                    (terminal 3)
const BASE = process.env.BASE || 'http://localhost:3005'

let failures = 0
let checks = 0
const ok = (cond, label, extra = '') => {
  checks++
  if (cond) console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`)
  else { failures++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}
const near = (a, b, eps = 0.02) => Math.abs(Number(a) - Number(b)) <= eps

async function api(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text.slice(0, 300) }
  return { status: res.status, body }
}
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) })
const patch = (p, b) => api(p, { method: 'PATCH', body: JSON.stringify(b) })
const del = (p) => api(p, { method: 'DELETE' })

// Dates locales : toISOString() décale d'un jour en fuseau +02 (le 1er du mois
// partait dans le mois précédent) — on formate à la main.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthOf = (d) => iso(d).slice(0, 7)
const today = new Date()
const dayIn = (offsetMonths, day) => {
  const d = new Date(today.getFullYear(), today.getMonth() + offsetMonths, day)
  return iso(d)
}
const cur = monthOf(today)
const m1 = monthOf(new Date(today.getFullYear(), today.getMonth() - 1, 15))
const m2 = monthOf(new Date(today.getFullYear(), today.getMonth() - 2, 15))

/* ------------------------------------------------------------------ reset */

// Tout passe par l'API (pas de connexion directe) : PGliteSocketServer ne tient
// qu'une connexion à la fois, un second client pg se fait réinitialiser.
async function reset() {
  // du plus ancien au plus récent : un GET matérialise les récurrentes du mois
  // courant à partir des mois passés, donc on vide l'historique d'abord.
  const monthKeys = [m2, m1, cur]
  for (const m of monthKeys) {
    const l = await api(`/api/business-expenses?month=${m}`)
    for (const r of l.body?.rows || []) await del(`/api/business-expenses/${r.id}`)
  }
  const bs = await api('/api/business-expense-budgets')
  for (const b of bs.body || []) await post('/api/business-expense-budgets', { category: b.category, monthly_amount: 0 })
  const assets = await api('/api/business-assets')
  for (const a of assets.body || []) if (a.category === 'savings') await del(`/api/business-assets/${a.id}`)
}

await api('/api/setup', { method: 'POST' })
await reset()
async function dropIncome() {
  for (const m of [m2, m1, cur]) {
    const l = await api(`/api/business-expenses?month=${m}&bucket=income`)
    for (const r of l.body?.rows || []) await del(`/api/business-expenses/${r.id}`)
  }
}
console.log(`Base remise à zéro\nCible : ${BASE}\nMois testés : ${m2} / ${m1} / ${cur}\n`)

/* ------------------------------------------------- 1. saisie & agrégats SQL */

console.log('1) Saisie et agrégats du mois')
const seed = [
  // historique (deux mois passés) : revenus + charges fixes + variables
  { label: 'Salaire', category: 'salaire', amount: 2600, spent_on: dayIn(-2, 27), owner_id: 4, recurring: true, recur_day: 27 },
  { label: 'Salaire', category: 'salaire', amount: 2400, spent_on: dayIn(-2, 28), owner_id: 5, recurring: true, recur_day: 28 },
  { label: 'Loyer', category: 'loyer', amount: 1150, spent_on: dayIn(-2, 3), owner_id: null, recurring: true, recur_day: 3 },
  { label: 'Électricité', category: 'charges', amount: 95, spent_on: dayIn(-2, 5), owner_id: null, recurring: true, recur_day: 5 },
  { label: 'Intermarché', category: 'courses', amount: 420, spent_on: dayIn(-2, 12), owner_id: 5 },
  { label: 'Resto', category: 'resto', amount: 130, spent_on: dayIn(-2, 18), owner_id: 4 },
  { label: 'Virement épargne', category: 'epargne', amount: 300, spent_on: dayIn(-2, 28), owner_id: null, recurring: true, recur_day: 28 },
  { label: 'Salaire', category: 'salaire', amount: 2600, spent_on: dayIn(-1, 27), owner_id: 4, recurring: true, recur_day: 27 },
  { label: 'Salaire', category: 'salaire', amount: 2400, spent_on: dayIn(-1, 28), owner_id: 5, recurring: true, recur_day: 28 },
  { label: 'Loyer', category: 'loyer', amount: 1150, spent_on: dayIn(-1, 3), owner_id: null, recurring: true, recur_day: 3 },
  { label: 'Électricité', category: 'charges', amount: 110, spent_on: dayIn(-1, 5), owner_id: null, recurring: true, recur_day: 5 },
  { label: 'Intermarché', category: 'courses', amount: 460, spent_on: dayIn(-1, 12), owner_id: 5 },
  { label: 'Essence', category: 'transport', amount: 140, spent_on: dayIn(-1, 9), owner_id: 4 },
  { label: 'Cinéma', category: 'loisirs', amount: 60, spent_on: dayIn(-1, 20), owner_id: null },
  { label: 'Virement épargne', category: 'epargne', amount: 300, spent_on: dayIn(-1, 28), owner_id: null, recurring: true, recur_day: 28 },
  // mois courant
  { label: 'Intermarché', category: 'courses', amount: 380, spent_on: dayIn(0, Math.min(2, today.getDate())), owner_id: 5 },
  { label: 'Essence', category: 'transport', amount: 120, spent_on: dayIn(0, Math.min(3, today.getDate())), owner_id: 4 },
  { label: 'Week-end Lisbonne', category: 'voyage', amount: 640, spent_on: dayIn(0, Math.min(4, today.getDate())), owner_id: null },
  { label: 'Billets avion', category: 'voyage', amount: 210, spent_on: dayIn(0, Math.min(5, today.getDate())), owner_id: 4 },
  { label: 'Resto italien', category: 'resto', amount: 85, spent_on: dayIn(0, Math.min(6, today.getDate())), owner_id: 4 },
]
let created = 0
for (const s of seed) {
  const r = await post('/api/business-expenses', s)
  if (r.status === 200) created++
  else console.log(`    ! ${s.label} -> ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`)
}
ok(created === seed.length, `${created}/${seed.length} lignes créées`, `POST /api/business-expenses`)

// le mois généré par Postgres doit regrouper des dates différentes du même mois
const july = await post('/api/business-expenses', { label: 'Test fin de mois', category: 'autre', amount: 10, spent_on: dayIn(0, 1), owner_id: 4 })
ok(july.status === 200 && july.body.spent_on === dayIn(0, 1), 'colonne month générée côté Postgres', `spent_on=${july.body?.spent_on}`)

/* ------------------------------------------- 2. matérialisation des récurrentes */

console.log('\n2) Charges récurrentes (générées automatiquement)')
const list = await api(`/api/business-expenses?month=${cur}`)
const autoRent = (list.body.rows || []).filter(r => r.label === 'Loyer')
const autoPower = (list.body.rows || []).filter(r => r.label === 'Électricité')
const autoSalary = (list.body.rows || []).filter(r => r.label === 'Salaire')
ok(autoRent.length === 1 && autoRent[0].source === 'auto', 'loyer du mois courant créé automatiquement', `jour=${autoRent[0]?.recur_day}`)
ok(autoRent[0]?.recur_day === 3, 'jour de prélèvement conservé', `recur_day=${autoRent[0]?.recur_day}`)
ok(autoPower.length === 1 && Number(autoPower[0].amount) === 110, 'dernier montant connu repris (électricité)', `${autoPower[0]?.amount}`)
ok(autoSalary.length === 2, 'salaire matérialisé pour les deux personnes', `${autoSalary.length} lignes`)

// idempotence : un second GET ne doit rien dupliquer
await api(`/api/business-expenses?month=${cur}`)
await api(`/api/business-expenses?month=${cur}`)
const again = await api(`/api/business-expenses?month=${cur}`)
const rentTwice = (again.body.rows || []).filter(r => r.label === 'Loyer')
ok(rentTwice.length === 1, 'pas de doublon après 3 lectures', `${rentTwice.length} ligne(s) loyer`)

/* --------------------------------------------------- 3. PATCH / DELETE */

console.log('\n3) Modification et suppression')
const target = again.body.rows.find(r => r.label === 'Resto italien')
const up = await patch(`/api/business-expenses/${target.id}`, { amount: 92.5, category: 'loisirs', notes: 'anniversaire' })
ok(up.status === 200 && Number(up.body.amount) === 92.5, 'montant modifié', `${target.amount} -> ${up.body.amount}`)
ok(up.body.category === 'loisirs' && up.body.bucket === 'variable', 'le bucket suit la catégorie', `${up.body.category} / ${up.body.bucket}`)
const ghost = await post('/api/business-expenses', { label: 'À supprimer', category: 'autre', amount: 3, spent_on: dayIn(0, 1) })
const rm = await del(`/api/business-expenses/${ghost.body.id}`)
ok(rm.status === 200, 'suppression', `id=${ghost.body.id}`)
const after400 = await patch(`/api/business-expenses/${ghost.body.id}`, { amount: 4 })
ok(after400.status === 404, 'PATCH après suppression -> 404', `status=${after400.status}`)
const bad = await post('/api/business-expenses', { label: '', category: 'courses', amount: 10 })
ok(bad.status === 400, 'libellé vide refusé', `status=${bad.status}`)
const unknown = await post('/api/business-expenses', { label: 'Catégorie inconnue', category: 'yolo', amount: 10, spent_on: dayIn(0, 1) })
ok(unknown.status === 200 && unknown.body.category === 'autre', 'catégorie inconnue -> autre', `bucket=${unknown.body?.bucket}`)

/* --------------------------------------------------------- 4. plafonds */

console.log('\n4) Plafonds mensuels')
// le PATCH de la section 3 a basculé la ligne « Resto italien » (92,50 €) en
// catégorie loisirs : c'est donc loisirs qui dépasse son plafond
const budget = await post('/api/business-expense-budgets', { category: 'loisirs', monthly_amount: 50 })
ok(budget.status === 200 && Number(budget.body.monthly_amount) === 50, 'plafond créé', 'loisirs = 50 €')
const budget2 = await post('/api/business-expense-budgets', { category: 'loisirs', monthly_amount: 80 })
ok(Number(budget2.body.monthly_amount) === 80, 'plafond mis à jour (upsert)', `-> ${budget2.body.monthly_amount} €`)
const budgetBad = await post('/api/business-expense-budgets', { category: 'nawak', monthly_amount: 10 })
ok(budgetBad.status === 400, 'catégorie inconnue refusée', `status=${budgetBad.status}`)
await post('/api/business-assets', { name: 'Livret A', category: 'savings', value: 4000, owner_id: 4 })

/* --------------------------------------------------------- 5. le bilan */

console.log('\n5) Bilan (report) — agrégats, score, conseils')
const rep = await api(`/api/business-expenses/report?months=6`)
ok(rep.status === 200 && !!rep.body.kpis, 'route /report non capturée par /[id]', `${rep.status}`)
const r = rep.body || {}
const k = r.kpis || {}
ok(Array.isArray(r.monthly) && r.monthly.length === 6, 'série de 6 mois continue', `${r.monthly?.length} points`)
ok(r.monthly?.[5]?.month === cur, 'dernier point = mois courant', `${r.monthly?.[5]?.month}`)
ok(r.monthly?.[0]?.month === monthOf(new Date(today.getFullYear(), today.getMonth() - 5, 1)), 'premier point = M-5', `${r.monthly?.[0]?.month}`)

// le mois courant : 2 salaires (5000) + loyer 1150 + élec 110 + variables + voyage
const expIncome = 5000
const expFixed = 1150 + 110
// courses 380 + transport 120 + resto 85→92.5 + 2 lignes « autre » de 10 € (tests unitaires)
const expVariable = 380 + 120 + 92.5 + 10 + 10
const expTravel = 640 + 210
ok(near(k.income, expIncome), `revenus du mois = ${expIncome} €`, `calculé ${k.income}`)
ok(near(k.fixed, expFixed), `charges fixes = ${expFixed} €`, `calculé ${k.fixed}`)
ok(near(k.variable, expVariable), `variable = ${expVariable} €`, `calculé ${k.variable}`)
ok(near(k.travel, expTravel), `voyage = ${expTravel} €`, `calculé ${k.travel}`)
ok(near(k.expense, expFixed + expVariable + expTravel), 'dépenses = fixes + variable + voyage', `${k.expense}`)
ok(near(k.savings, 300), 'épargne du mois = 300 €', `calculé ${k.savings}`)
ok(near(k.savedRate, 300 / 5000, 0.0005), "taux d'épargne = 6 %", `${(k.savedRate * 100).toFixed(2)} %`)
ok(near(k.balance, 5000 - (expFixed + expVariable + expTravel) - 300), 'reste = revenus − dépenses − épargne', `${k.balance}`)
ok(k.projectedExpense !== null && k.projectedExpense >= k.expense, 'projection de fin de mois', `${k.projectedExpense} €`)

// repère 50/30/20 et ancienneté de la donnée
ok(k.needs > 0 && k.wants > 0, 'besoins / envies ventilés', `besoins ${k.needs} € · envies ${k.wants} €`)
ok(r.score && r.score.dimensions.length === 5, 'score sur 5 dimensions', `${r.score?.total}/${r.score?.max}`)
const dims = r.score.dimensions.map(d => d.key).join(',')
ok(dims === 'savings,fixed,lifestyle,budgets,cushion', 'dimensions attendues', dims)
ok(r.score.total > 0 && r.score.total <= r.score.max, 'score dans les bornes', `${r.score.total}/${r.score.max} — ${r.score.label}`)
const overBudget = (r.budgets || []).find(b => b.category === 'loisirs')
ok(!!overBudget && overBudget.over > 0, 'dépassement de plafond détecté', `loisirs ${overBudget?.spent} € / ${overBudget?.budget} € (${Math.round(overBudget?.pct)} %)`)
const budgetDim = (r.score?.dimensions || []).find(d => d.key === 'budgets')
ok(budgetDim?.points === 0, 'le dépassement fait tomber le critère plafonds à 0', `${budgetDim?.points}/${budgetDim?.max}`)
ok(near(r.savings.assetsSavings, 4000), 'épargne du patrimoine reprise', `${r.savings.assetsSavings} €`)
ok(r.savings.coverageMonths > 0, "fonds d'urgence exprimé en mois de charges", `${r.savings.coverageMonths} mois`)
ok(near(r.recurring.total, 1150 + 110), 'récurrentes fixes = loyer + électricité', `${r.recurring.total} €`)
ok((r.recurring.rows || []).length === 5, '5 engagements récurrents distincts (2 salaires, loyer, élec, épargne)', `${r.recurring.rows.length}`)
ok((r.owners.rows || []).length === 3, 'les 3 porteurs (Aksel, Amandine, commun) sont séparés', `${r.owners.rows.map(o => o.name).join(' / ')}`)
ok((r.categories || []).some(c => c.category === 'voyage' && c.bucket === 'travel'), 'voyage suivi à part', 'bucket travel')

// conseils : triés par gravité, chiffrés, et cohérents avec les dépassements
const ins = r.insights || []
ok(ins.length >= 4, `${ins.length} conseils générés`)
const order = { alert: 0, warn: 1, info: 2, ok: 3 }
const sorted = ins.every((x, i) => i === 0 || (order[ins[i - 1].severity] ?? 9) <= (order[x.severity] ?? 9))
ok(sorted, 'conseils triés du plus grave au plus anodin', ins.map(x => x.severity).join(' > '))
const hasImpact = ins.filter(x => x.severity === 'warn' || x.severity === 'alert').length
ok(hasImpact >= 1, `${hasImpact} conseil(s) d'alerte/vigilance`, ins.filter(x => x.severity === 'alert' || x.severity === 'warn')[0]?.title || '')
ok(ins.some(x => /plafond/i.test(x.title + x.text)), 'dépassement remonté dans les conseils', ins.find(x => /plafond/i.test(x.title))?.title)
ok(ins.some(x => /Voyages/.test(x.title)), 'provision voyage conseillée', ins.find(x => /Voyages/.test(x.title))?.title)
console.log('    conseils : ' + ins.map(x => `[${x.severity}] ${x.title}`).join(' | ').slice(0, 700))

/* ------------------------------------------------ 6. cas limite : aucun revenu */

console.log('\n6) Robustesse (pas de division par zéro, mois vide)')
const empty = await api('/api/business-expenses?month=2019-01')
ok(empty.status === 200 && empty.body.rows.length === 0 && empty.body.summary.income === 0, 'mois sans donnée', 'summary à 0')
const emptyRep = await api('/api/business-expenses/report?months=1')
ok(emptyRep.status === 200, 'report sur 1 mois', `status=${emptyRep.status}`)

await dropIncome()
const noIncome = await api('/api/business-expenses/report?months=6')
const ni = noIncome.body || {}
ok(noIncome.status === 200 && ni.kpis.hasIncome === false, 'report sans revenus : pas de NaN', `savedRate=${ni.kpis?.savedRate}`)
ok(!Number.isNaN(ni.score?.total) && ni.score?.dimensions.length === 2, 'score réduit aux critères calculables', `${ni.score?.total}/${ni.score?.max}`)
ok((ni.insights || []).some(x => /revenu/i.test(x.title)), 'conseil « déclare tes revenus »', ni.insights?.[0]?.title)
ok(Number.isFinite(ni.kpis?.expense) && Number.isFinite(ni.score?.total), 'aucun NaN dans les chiffres', `expense=${ni.kpis?.expense} score=${ni.score?.total}`)

/* ------------------------------------------------------------------- fin */

console.log(`\n${failures === 0 ? '✅' : '❌'} ${checks - failures}/${checks} vérifications passées`)
process.exit(failures === 0 ? 0 : 1)
