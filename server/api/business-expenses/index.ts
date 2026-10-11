import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import {
  ensureBusinessExpensesTable, materializeRecurring, categoryDef, bucketOf,
  EXPENSE_CATEGORIES, EXPENSE_PAYMENTS, EXPENSE_BUCKETS,
  EXPENSE_ROW_SQL, EXPENSE_ROW_MONEY_PLAIN, MONTHS_SQL,
} from '../../utils/businessExpenses'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const monthStart = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${m}-01` : null)

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessExpensesTable()

  if (e.method === 'GET') {
    // Les charges récurrentes du mois courant sont (re)créées avant lecture :
    // loyer, abonnements, salaire… ne sont saisis qu'une fois.
    await materializeRecurring(account.partnership_id)

    const { month, owner, bucket, category } = getQuery(e)
    const m = monthStart(String(month || currentMonth()))
    if (!m) throw createError({ statusCode: 400, message: 'month must be YYYY-MM' })

    const where: string[] = ['e.partnership_id = $1', 'e.month = $2::date']
    const params: any[] = [account.partnership_id, m]
    if (owner === 'common') where.push('e.owner_id IS NULL')
    else if (owner && owner !== 'all') { params.push(Number(owner)); where.push(`e.owner_id = $${params.length}`) }
    if (bucket && EXPENSE_BUCKETS.includes(bucket as any)) { params.push(bucket); where.push(`e.bucket = $${params.length}`) }
    if (category) { params.push(String(category)); where.push(`e.category = $${params.length}`) }

    const rows = (await query(
      `${EXPENSE_ROW_SQL} WHERE ${where.join(' AND ')} ORDER BY e.spent_on DESC, e.id DESC`,
      params)).rows

    // Résumé du mois filtré : les cartes doivent coller à ce qu'on voit dans la liste
    const summary = (await query(`
      SELECT COALESCE(SUM(CASE WHEN e.bucket = 'income' THEN e.amount END), 0)::float8 AS income,
             COALESCE(SUM(CASE WHEN e.bucket = 'fixed' THEN e.amount END), 0)::float8 AS fixed,
             COALESCE(SUM(CASE WHEN e.bucket = 'variable' THEN e.amount END), 0)::float8 AS variable,
             COALESCE(SUM(CASE WHEN e.bucket = 'travel' THEN e.amount END), 0)::float8 AS travel,
             COALESCE(SUM(CASE WHEN e.bucket = 'savings' THEN e.amount END), 0)::float8 AS savings,
             COALESCE(SUM(CASE WHEN e.bucket = 'investment' THEN e.amount END), 0)::float8 AS investment,
             COUNT(*)::int AS count
      FROM business_expenses e
      WHERE ${where.join(' AND ')}`, params)).rows[0]

    const income = Number(summary.income) || 0
    const expense = (Number(summary.fixed) || 0) + (Number(summary.variable) || 0) + (Number(summary.travel) || 0)
    const saved = (Number(summary.savings) || 0) + (Number(summary.investment) || 0)
    const months = (await query(MONTHS_SQL, [account.partnership_id])).rows.map((r: any) => r.month)
    if (!months.includes(currentMonth())) months.unshift(currentMonth())

    return {
      month: String(month || currentMonth()),
      months,
      rows,
      summary: {
        income, expense: Math.round(expense * 100) / 100, saved: Math.round(saved * 100) / 100,
        fixed: Number(summary.fixed) || 0, variable: Number(summary.variable) || 0,
        travel: Number(summary.travel) || 0, savings: Number(summary.savings) || 0,
        investment: Number(summary.investment) || 0,
        balance: Math.round((income - expense - saved) * 100) / 100,
        count: Number(summary.count) || 0,
      },
    }
  }

  if (e.method === 'POST') {
    const b = await readBody(e) || {}
    const label = String(b.label || '').trim()
    if (!label) throw createError({ statusCode: 400, message: 'label is required' })

    // Catégorie inconnue -> 'autre' : le bucket n'est jamais fourni par le client
    const category = EXPENSE_CATEGORIES.some(c => c.key === b.category) ? String(b.category) : 'autre'
    const amount = Number.isFinite(+b.amount) ? Math.max(0, Math.round(+b.amount * 100) / 100) : 0
    const spentOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b.spent_on)) ? String(b.spent_on) : new Date().toISOString().slice(0, 10)
    const payment = EXPENSE_PAYMENTS.includes(b.payment) ? b.payment : 'cb'
    const ownerId = Number.isInteger(Number(b.owner_id)) && Number(b.owner_id) > 0 ? Number(b.owner_id) : null
    const recurring = !!b.recurring
    const recurDay = recurring
      ? Math.min(28, Math.max(1, Number.isInteger(Number(b.recur_day)) ? Number(b.recur_day) : new Date(spentOn + 'T12:00:00').getDate()))
      : null

    const r = await query(
      `INSERT INTO business_expenses
         (partnership_id, owner_id, created_by, label, category, bucket, amount, spent_on, payment, recurring, recur_day, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, 'manual')
       RETURNING ${EXPENSE_ROW_MONEY_PLAIN}`,
      [account.partnership_id, ownerId, account.id, label, category, bucketOf(category), amount,
       spentOn, payment, recurring, recurDay, b.notes || '']
    )
    return { ...r.rows[0], owner_name: null, owner_color: null }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
