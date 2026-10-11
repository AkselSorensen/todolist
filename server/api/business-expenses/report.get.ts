import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessAssetsTable } from '../../utils/businessAssets'
import {
  ensureBusinessExpensesTable, materializeRecurring, buildReport,
  MONTHLY_SQL, CATEGORY_SQL, OWNER_SQL, RECURRING_SQL,
} from '../../utils/businessExpenses'

// Bilan mensuel : agrégats SQL (par mois, par catégorie, par personne) puis analyse
// pure dans businessExpenses.buildReport — c'est là que vivent score et conseils.
export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessExpensesTable()
  await ensureBusinessAssetsTable()

  const q = getQuery(e)
  const months = Math.min(24, Math.max(1, Number(q.months) || 6))
  const span = String(months - 1)
  const pid = account.partnership_id

  await materializeRecurring(pid)

  const monthly = (await query(MONTHLY_SQL, [pid, span])).rows
  const categories = (await query(CATEGORY_SQL, [pid, span])).rows
  const owners = (await query(OWNER_SQL, [pid])).rows
  const recurring = (await query(RECURRING_SQL, [pid])).rows
  const budgets = (await query(`
    SELECT id, category, monthly_amount::float8 AS monthly_amount
    FROM business_expense_budgets
    WHERE partnership_id = $1
    ORDER BY category ASC`, [pid])).rows
  // Fonds d'urgence = ce qui est rangé en épargne dans le patrimoine
  const assets = (await query(`
    SELECT COALESCE(SUM(CASE WHEN category = 'savings' THEN value END), 0)::float8 AS savings,
           COALESCE(SUM(value), 0)::float8 AS total
    FROM business_assets
    WHERE partnership_id = $1`, [pid])).rows[0]

  return buildReport({ monthly, categories, owners, recurring, budgets, assets }, { months })
})
