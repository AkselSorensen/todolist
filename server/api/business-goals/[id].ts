import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessGoalsTable, GOAL_METRICS, GOAL_STATUSES, GOAL_FIELDS } from '../../utils/businessGoals'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessGoalsTable()

  const id = Number(getRouterParam(e, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid id' })

  if (e.method === 'GET') {
    const r = await query(
      `SELECT g.id, g.title, g.metric, g.year, g.due_date, g.status, g.notes, g.owner_id,
              g.created_at, g.updated_at,
              g.target_amount::float8 AS target_amount, g.current_amount::float8 AS current_amount
       FROM business_goals g WHERE g.id = $1 AND g.partnership_id = $2`,
      [id, account.partnership_id])
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Goal not found' })
    return r.rows[0]
  }

  if (e.method === 'PATCH') {
    const body = await readBody(e) || {}
    const sets: string[] = []
    const params: any[] = []
    for (const [k, v] of Object.entries(body)) {
      if (!GOAL_FIELDS.includes(k)) continue
      if (k === 'metric' && !GOAL_METRICS.includes(v as any)) continue
      if (k === 'status' && !GOAL_STATUSES.includes(v as any)) continue
      if (k === 'title' && !String(v || '').trim()) continue
      if (k === 'owner_id') {
        const oid = Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null
        params.push(oid); sets.push(`owner_id = $${params.length}`); continue
      }
      if (k === 'year') {
        if (!Number.isInteger(Number(v))) continue
        params.push(Number(v)); sets.push(`year = $${params.length}`); continue
      }
      if (k === 'target_amount' || k === 'current_amount') {
        params.push(Number.isFinite(+v) ? Math.max(0, +v) : 0); sets.push(`${k} = $${params.length}`); continue
      }
      if (k === 'due_date' && (v === '' || v === undefined)) { params.push(null); sets.push(`due_date = $${params.length}`); continue }
      params.push(v)
      sets.push(`${k} = $${params.length}`)
    }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    const idParam = params.push(id)
    const pidParam = params.push(account.partnership_id)
    sets.push('updated_at = NOW()')
    const r = await query(
      `UPDATE business_goals SET ${sets.join(', ')} WHERE id = $${idParam} AND partnership_id = $${pidParam} RETURNING id`,
      params)
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Goal not found' })
    return { success: true, id }
  }

  if (e.method === 'DELETE') {
    const r = await query('DELETE FROM business_goals WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    if (r.rowCount === 0) throw createError({ statusCode: 404, message: 'Goal not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
