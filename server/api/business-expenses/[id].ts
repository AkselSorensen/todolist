import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import {
  ensureBusinessExpensesTable, EXPENSE_CATEGORIES, EXPENSE_PAYMENTS,
  EXPENSE_FIELDS, bucketOf, EXPENSE_ROW_SQL,
} from '../../utils/businessExpenses'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessExpensesTable()

  const id = Number(getRouterParam(e, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid id' })

  if (e.method === 'GET') {
    const r = await query(`${EXPENSE_ROW_SQL} WHERE e.id = $1 AND e.partnership_id = $2`, [id, account.partnership_id])
    if (!r.rows.length) throw createError({ statusCode: 404, message: 'Expense not found' })
    return r.rows[0]
  }

  if (e.method === 'PATCH') {
    const body = await readBody(e) || {}
    const sets: string[] = []
    const params: any[] = []
    for (const [k, v] of Object.entries(body)) {
      if (!EXPENSE_FIELDS.includes(k)) continue
      if (k === 'label') {
        if (!String(v || '').trim()) continue
        params.push(String(v).trim()); sets.push(`label = $${params.length}`); continue
      }
      if (k === 'category') {
        if (!EXPENSE_CATEGORIES.some(c => c.key === v)) continue
        params.push(String(v)); sets.push(`category = $${params.length}`)
        // le bucket suit toujours la catégorie
        params.push(bucketOf(String(v))); sets.push(`bucket = $${params.length}`)
        continue
      }
      if (k === 'amount') { params.push(Number.isFinite(+v) ? Math.max(0, Math.round(+v * 100) / 100) : 0); sets.push(`amount = $${params.length}`); continue }
      if (k === 'spent_on') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) continue
        params.push(String(v)); sets.push(`spent_on = $${params.length}::date`); continue
      }
      if (k === 'payment') { if (!EXPENSE_PAYMENTS.includes(v as any)) continue; params.push(String(v)); sets.push(`payment = $${params.length}`); continue }
      if (k === 'recurring') { params.push(!!v); sets.push(`recurring = $${params.length}`); continue }
      if (k === 'recur_day') {
        const d = Number.isInteger(Number(v)) ? Math.min(28, Math.max(1, Number(v))) : null
        params.push(d); sets.push(`recur_day = $${params.length}`); continue
      }
      if (k === 'owner_id') {
        const oid = Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null
        params.push(oid); sets.push(`owner_id = $${params.length}`); continue
      }
      params.push(v); sets.push(`${k} = $${params.length}`)
    }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    const idParam = params.push(id)
    const pidParam = params.push(account.partnership_id)
    sets.push('updated_at = NOW()')
    const r = await query(
      `UPDATE business_expenses SET ${sets.join(', ')}
       WHERE id = $${idParam} AND partnership_id = $${pidParam}
       RETURNING id, label, category, bucket, amount::float8 AS amount,
                 to_char(spent_on, 'YYYY-MM-DD') AS spent_on, payment, recurring, recur_day, notes, source, owner_id`,
      params)
    if (!r.rows.length) throw createError({ statusCode: 404, message: 'Expense not found' })
    return r.rows[0]
  }

  if (e.method === 'DELETE') {
    const r = await query('DELETE FROM business_expenses WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    if (!r.rowCount) throw createError({ statusCode: 404, message: 'Expense not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
