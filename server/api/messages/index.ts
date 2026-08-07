import { query } from '../../utils/db'

// Auto-create messages table if it doesn't exist
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      from_id INT REFERENCES accounts(id),
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export default defineEventHandler(async (e) => {
  // No auth required — from_id is passed by the client
  const PARTNERSHIP_ID = 1
  await ensureTable()

  if (e.method === 'GET') {
    const { since } = getQuery(e)
    let sql = `SELECT m.*, a.name as from_name, a.color as from_color
               FROM messages m LEFT JOIN accounts a ON m.from_id = a.id
               WHERE m.partnership_id = $1`
    const params: any[] = [PARTNERSHIP_ID]; let i = 2
    if (since) { sql += ` AND m.id > $${i++}`; params.push(since) }
    sql += ' ORDER BY m.created_at ASC LIMIT 100'
    const result = await query(sql, params)
    return result.rows
  }

  if (e.method === 'POST') {
    const body = await readBody(e)
    const { message, from_id } = body
    if (!message || !message.trim()) throw createError({ statusCode: 400, message: 'Message required' })
    if (!from_id || ![4, 5].includes(from_id)) throw createError({ statusCode: 400, message: 'Invalid from_id' })

    const r = await query(
      `INSERT INTO messages (partnership_id, from_id, message) VALUES ($1,$2,$3) RETURNING *`,
      [PARTNERSHIP_ID, from_id, message.trim()]
    )
    return { ...r.rows[0], from_name: from_id === 4 ? 'Aksel' : 'Amandine', from_color: from_id === 4 ? '#4da6ff' : '#ff6b8a' }
  }

  if (e.method === 'PATCH') {
    const { my_id } = await readBody(e)
    await query('UPDATE messages SET read = true WHERE partnership_id = $1 AND from_id != $2 AND read = false',
      [PARTNERSHIP_ID, my_id || 4])
    return { success: true }
  }
})
