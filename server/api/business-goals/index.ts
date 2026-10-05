import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessGoalsTable, GOAL_MONEY, GOAL_MONEY_PLAIN, GOAL_METRICS, GOAL_STATUSES } from '../../utils/businessGoals'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessGoalsTable()

  if (e.method === 'GET') {
    const { year, owner } = getQuery(e)
    let sql = `
      SELECT g.id, g.title, g.metric, g.year, g.due_date, g.status, g.notes, g.owner_id,
             g.created_at, g.updated_at, ${GOAL_MONEY},
             o.name as owner_name, o.color as owner_color
      FROM business_goals g
      LEFT JOIN accounts o ON g.owner_id = o.id
      WHERE g.partnership_id = $1
    `
    const params: any[] = [account.partnership_id]
    if (year) { params.push(Number(year)); sql += ` AND g.year = $${params.length}` }
    if (owner === 'common') sql += ' AND g.owner_id IS NULL'
    else if (owner) { params.push(Number(owner)); sql += ` AND g.owner_id = $${params.length}` }
    sql += ' ORDER BY g.year DESC, g.owner_id NULLS LAST, g.id ASC'
    return (await query(sql, params)).rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    if (!b?.title || !String(b.title).trim()) throw createError({ statusCode: 400, message: 'title is required' })
    const metric = GOAL_METRICS.includes(b.metric) ? b.metric : 'custom'
    const status = GOAL_STATUSES.includes(b.status) ? b.status : 'active'
    const ownerId = Number.isInteger(Number(b.owner_id)) && Number(b.owner_id) > 0 ? Number(b.owner_id) : null
    const year = Number.isInteger(Number(b.year)) ? Number(b.year) : new Date().getFullYear()
    const num = (v: any) => (Number.isFinite(+v) ? Math.max(0, +v) : 0)
    const r = await query(
      `INSERT INTO business_goals
         (partnership_id, owner_id, title, metric, target_amount, current_amount, year, due_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, metric, year, due_date, status, notes, owner_id, created_at, updated_at, ${GOAL_MONEY_PLAIN}`,
      [account.partnership_id, ownerId, String(b.title).trim(), metric, num(b.target_amount), num(b.current_amount),
       year, b.due_date || null, status, b.notes || '', account.id]
    )
    return r.rows[0]
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
