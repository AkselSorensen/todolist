import { query } from '../../utils/db'

// GET all events, optionally filter by date range
export default defineEventHandler(async (e) => {
  const method = e.method
  const { from, to, type } = getQuery(e)

  if (method === 'GET') {
    let sql = `
      SELECT ce.*, u.name as creator_name, u.color as creator_color
      FROM calendar_events ce
      LEFT JOIN users u ON ce.created_by = u.id
      WHERE 1=1
    `
    const params: any[] = []
    let i = 1

    if (from) { sql += ` AND ce.start_time >= $${i++}`; params.push(from) }
    if (to) { sql += ` AND ce.start_time <= $${i++}`; params.push(to) }
    if (type) { sql += ` AND ce.event_type = $${i++}`; params.push(type) }

    sql += ' ORDER BY ce.start_time ASC'
    
    const result = await query(sql, params)
    return result.rows
  }

  // POST create event
  if (method === 'POST') {
    const body = await readBody(e)
    const { title, description, event_type, start_time, end_time, all_day, created_by, alert_before, color, location } = body

    const result = await query(
      `INSERT INTO calendar_events (title, description, event_type, start_time, end_time, all_day, created_by, alert_before, color, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [title, description || '', event_type || 'event', start_time, end_time || null, all_day || false,
       created_by || 1, alert_before || 0, color || '#a78bfa', location || '']
    )
    return result.rows[0]
  }

  // DELETE event
  if (method === 'DELETE') {
    const { id } = getQuery(e)
    await query('DELETE FROM calendar_events WHERE id = $1', [id])
    return { success: true }
  }
})
