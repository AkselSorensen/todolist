import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessDatesTable, BUSINESS_KINDS, BUSINESS_STATUSES } from '../../utils/businessDates'

const EDITABLE = ['title', 'contact', 'kind', 'location', 'meeting_url', 'starts_at', 'ends_at', 'all_day', 'status', 'reminder_min', 'notes']

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessDatesTable()

  const id = Number(getRouterParam(e, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid id' })

  if (e.method === 'GET') {
    const r = await query(
      `SELECT b.*, a.name as owner_name, a.color as owner_color
       FROM business_dates b LEFT JOIN accounts a ON b.created_by = a.id
       WHERE b.id = $1 AND b.partnership_id = $2`, [id, account.partnership_id])
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Business date not found' })
    return r.rows[0]
  }

  if (e.method === 'PATCH') {
    const body = await readBody(e) || {}
    // Si on déplace la fin, on la compare au début effectif (celui du corps, sinon celui en base)
    if (body.ends_at) {
      const start = body.starts_at || (await query(
        'SELECT starts_at FROM business_dates WHERE id = $1 AND partnership_id = $2',
        [id, account.partnership_id])).rows[0]?.starts_at
      if (start && new Date(body.ends_at).getTime() <= new Date(start).getTime()) body.ends_at = null
    }
    const sets: string[] = []
    const params: any[] = []
    for (const [k, v] of Object.entries(body)) {
      if (!EDITABLE.includes(k)) continue
      if (k === 'kind' && !BUSINESS_KINDS.includes(v as any)) continue
      if (k === 'status' && !BUSINESS_STATUSES.includes(v as any)) continue
      if (k === 'ends_at' && (v === '' || v === undefined)) { params.push(null); sets.push(`ends_at = $${params.length}`); continue }
      if (k === 'title' && !String(v || '').trim()) continue
      params.push(v === '' && (k === 'reminder_min' || k === 'all_day') ? null : v)
      sets.push(`${k} = $${params.length}`)
    }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    const idParam = params.push(id)
    const pidParam = params.push(account.partnership_id)
    sets.push('updated_at = NOW()')
    const r = await query(
      `UPDATE business_dates SET ${sets.join(', ')} WHERE id = $${idParam} AND partnership_id = $${pidParam} RETURNING *`,
      params
    )
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Business date not found' })
    return r.rows[0]
  }

  if (e.method === 'DELETE') {
    const r = await query('DELETE FROM business_dates WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    if (r.rowCount === 0) throw createError({ statusCode: 404, message: 'Business date not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
