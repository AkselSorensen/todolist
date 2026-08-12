import { query } from '../../utils/db'
import webpush from 'web-push'

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

async function sendPush(partnershipId: number, title: string, body: string) {
  try {
    const config = useRuntimeConfig()
    webpush.setVapidDetails('mailto:nousdeux@example.com', config.vapidPublicKey, config.vapidPrivateKey)
    const subs = await query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE partnership_id = $1', [partnershipId])
    for (const sub of subs.rows) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, JSON.stringify({ title, body, icon: '/icons/icon.svg' }))
      } catch (e: any) {
        if (e.statusCode === 410) {
          await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
        }
      }
    }
  } catch { /* silent */ }
}

const PARTNERSHIP_ID = 1
const NAMES: Record<number, string> = { 4: 'Aksel', 5: 'Amandine' }
const COLORS: Record<number, string> = { 4: '#4da6ff', 5: '#ff6b8a' }

export default defineEventHandler(async (e) => {
  await ensureTable()
  const method = e.method

  if (method === 'GET') {
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

  if (method === 'POST') {
    const body = await readBody(e)
    const { message, from_id } = body
    if (!message || !message.trim()) throw createError({ statusCode: 400, message: 'Message required' })
    if (!from_id || ![4, 5].includes(from_id)) throw createError({ statusCode: 400, message: 'Invalid from_id' })

    const r = await query(
      `INSERT INTO messages (partnership_id, from_id, message) VALUES ($1,$2,$3) RETURNING *`,
      [PARTNERSHIP_ID, from_id, message.trim()]
    )

    const senderName = NAMES[from_id]
    const toId = from_id === 4 ? 5 : 4
    const preview = message.trim().length > 60 ? message.trim().slice(0, 60) + '…' : message.trim()

    // In-app notification
    await query(
      `INSERT INTO notifications (partnership_id, from_id, to_id, type, message, link) VALUES ($1,$2,$3,'message',$4,$5)`,
      [PARTNERSHIP_ID, from_id, toId, `${senderName} : ${preview}`, '/messages']
    )

    // Push notification
    sendPush(PARTNERSHIP_ID, `💬 ${senderName}`, preview)

    return { ...r.rows[0], from_name: senderName, from_color: COLORS[from_id] }
  }

  if (method === 'PATCH') {
    const body = await readBody(e)
    // Edit a specific message
    if (body.id && body.message != null) {
      const r = await query(
        'UPDATE messages SET message = $1 WHERE id = $2 AND partnership_id = $3 RETURNING *',
        [body.message.trim(), body.id, PARTNERSHIP_ID]
      )
      if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Message not found' })
      return { ...r.rows[0], edited: true }
    }
    // Mark all as read
    const { my_id } = body
    await query('UPDATE messages SET read = true WHERE partnership_id = $1 AND from_id != $2 AND read = false',
      [PARTNERSHIP_ID, my_id || 4])
    return { success: true }
  }

  if (method === 'DELETE') {
    const { id, from_id } = getQuery(e)
    if (!id) throw createError({ statusCode: 400, message: 'id required' })
    await query('DELETE FROM messages WHERE id = $1 AND partnership_id = $2',
      [Number(id), PARTNERSHIP_ID])
    return { success: true }
  }
})
