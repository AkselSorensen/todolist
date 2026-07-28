import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  const method = e.method

  try {
    if (method === 'GET') {
      const { from, to, type } = getQuery(e)
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

    if (method === 'POST') {
      const body = await readBody(e)
      // Allow 'trip' to map to 'event' if the constraint hasn't been updated yet
      let eventType = body.event_type || 'event'
      // Temporarily map 'trip' to 'event' to avoid constraint issues
      if (eventType === 'trip') eventType = 'event'

      const result = await query(
        `INSERT INTO calendar_events (title, description, event_type, start_time, end_time, all_day, created_by, alert_before, color, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [body.title, body.description || '', eventType, body.start_time, body.end_time || null, body.all_day || false,
         body.created_by || 1, body.alert_before || 0, body.color || '#a78bfa', body.location || '']
      )
      return result.rows[0]
    }

    if (method === 'DELETE') {
      const { id } = getQuery(e)
      if (!id) throw createError({ statusCode: 400, message: 'Missing id' })
      await query('DELETE FROM calendar_events WHERE id = $1', [id])
      return { success: true }
    }
  } catch (err: any) {
    console.error('Calendar API error:', err.message || err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Internal error',
    })
  }
})
