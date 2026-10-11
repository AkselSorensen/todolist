import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessExpensesTable, EXPENSE_CATEGORIES } from '../../utils/businessExpenses'

// Plafonds mensuels par catégorie (au niveau du couple).
export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessExpensesTable()

  if (e.method === 'GET') {
    return (await query(`
      SELECT id, category, monthly_amount::float8 AS monthly_amount, updated_at
      FROM business_expense_budgets
      WHERE partnership_id = $1
      ORDER BY category ASC`, [account.partnership_id])).rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e) || {}
    if (!EXPENSE_CATEGORIES.some(c => c.key === b.category)) throw createError({ statusCode: 400, message: 'Unknown category' })
    const amount = Number.isFinite(+b.monthly_amount) ? Math.max(0, Math.round(+b.monthly_amount * 100) / 100) : 0
    // Un plafond à 0 n'a pas de sens : il supprime le plafond
    if (amount === 0) {
      await query('DELETE FROM business_expense_budgets WHERE partnership_id = $1 AND category = $2', [account.partnership_id, b.category])
      return { success: true, removed: true }
    }
    const r = await query(`
      INSERT INTO business_expense_budgets (partnership_id, category, monthly_amount, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (partnership_id, category)
      DO UPDATE SET monthly_amount = EXCLUDED.monthly_amount, updated_at = NOW()
      RETURNING id, category, monthly_amount::float8 AS monthly_amount`,
      [account.partnership_id, b.category, amount, account.id])
    return r.rows[0]
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
