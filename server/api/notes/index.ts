import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const pid = account.partnership_id

  if (e.method === 'GET') {
    // Get notes addressed to me (or from me)
    const { sent } = getQuery(e)
    if (sent === 'true') {
      const result = await query(
        `SELECT n.*, a.name as to_name FROM love_notes n
         LEFT JOIN accounts a ON n.to_id = a.id
         WHERE n.from_id = $1 AND n.partnership_id = $2 ORDER BY n.created_at DESC`,
        [account.id, pid]
      )
      return result.rows
    }
    const result = await query(
      `SELECT n.*, a.name as from_name, a.color as from_color FROM love_notes n
       LEFT JOIN accounts a ON n.from_id = a.id
       WHERE n.to_id = $1 AND n.partnership_id = $2 ORDER BY n.created_at DESC`,
      [account.id, pid]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const body = await readBody(e)
    const toId = body.to_id || account.partner_id
    if (!toId) throw createError({ statusCode: 400, message: 'No partner to send to' })
    const result = await query(
      `INSERT INTO love_notes (partnership_id, from_id, to_id, message) VALUES ($1,$2,$3,$4) RETURNING *`,
      [pid, account.id, toId, body.message]
    )
    return result.rows[0]
  }

  if (e.method === 'PATCH') {
    const { id, read } = await readBody(e)
    await query('UPDATE love_notes SET read = $1 WHERE id = $2 AND partnership_id = $3', [read, id, pid])
    return { success: true }
  }
})
