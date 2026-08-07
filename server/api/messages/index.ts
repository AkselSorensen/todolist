import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    const { since } = getQuery(e)
    let sql = `SELECT m.*, a.name as from_name, a.color as from_color
               FROM messages m LEFT JOIN accounts a ON m.from_id = a.id
               WHERE m.partnership_id = $1`
    const params: any[] = [account.partnership_id]; let i = 2
    if (since) { sql += ` AND m.id > $${i++}`; params.push(since) }
    sql += ' ORDER BY m.created_at ASC LIMIT 100'
    const result = await query(sql, params)

    // Mark partner's messages as read
    const partnerMsgs = result.rows.filter((r: any) => r.from_id !== account.id && !r.read).map((r: any) => r.id)
    if (partnerMsgs.length > 0) {
      await query(`UPDATE messages SET read = true WHERE id = ANY($1)`, [partnerMsgs])
    }

    return result.rows
  }

  if (e.method === 'POST') {
    const { message } = await readBody(e)
    if (!message || !message.trim()) throw createError({ statusCode: 400, message: 'Message required' })

    const r = await query(
      `INSERT INTO messages (partnership_id, from_id, message) VALUES ($1,$2,$3) RETURNING *`,
      [account.partnership_id, account.id, message.trim()]
    )
    return { ...r.rows[0], from_name: account.name, from_color: account.color }
  }

  if (e.method === 'PATCH') {
    // Mark all as read
    await query('UPDATE messages SET read = true WHERE partnership_id = $1 AND from_id != $2 AND read = false',
      [account.partnership_id, account.id])
    return { success: true }
  }
})
