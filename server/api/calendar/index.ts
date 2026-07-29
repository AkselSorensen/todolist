import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  const method = e.method

  try {
    if (method === 'GET') {
      const { from, to, type } = getQuery(e)
      let sql = `SELECT ce.*, u.name as cn, u.color as cc FROM calendar_events ce LEFT JOIN accounts u ON ce.created_by = u.id WHERE ce.partnership_id = $1`
      const params: any[] = [account.partnership_id]; let i = 2
      if (from) { sql += ` AND ce.start_time >= $${i++}`; params.push(from) }
      if (to) { sql += ` AND ce.start_time <= $${i++}`; params.push(to) }
      if (type) { sql += ` AND ce.event_type = $${i++}`; params.push(type) }
      sql += ' ORDER BY ce.start_time ASC'
      return (await query(sql, params)).rows
    }
    if (method === 'POST') {
      const body = await readBody(e)
      let et = body.event_type || 'event'; if (et === 'trip') et = 'event'
      const r = await query(
        `INSERT INTO calendar_events (title, description, event_type, start_time, end_time, all_day, created_by, alert_before, color, location, partnership_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.title, body.description || '', et, body.start_time, body.end_time || null, body.all_day || false,
         account.id, body.alert_before || 0, body.color || '#a78bfa', body.location || '', account.partnership_id])
      return r.rows[0]
    }
    if (method === 'DELETE') {
      const { id } = getQuery(e)
      if (!id) throw createError({ statusCode: 400 })
      await query('DELETE FROM calendar_events WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
      return { success: true }
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message || 'Internal error' })
  }
})
