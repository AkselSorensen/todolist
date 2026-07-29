import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    const { sent } = getQuery(e)
    if (sent === 'true') {
      return (await query(`SELECT n.*, a.name as tn FROM love_notes n LEFT JOIN accounts a ON n.to_id = a.id WHERE n.from_id = $1 AND n.partnership_id = $2 ORDER BY n.created_at DESC`, [account.id, account.partnership_id])).rows
    }
    return (await query(`SELECT n.*, a.name as fn, a.color as fc FROM love_notes n LEFT JOIN accounts a ON n.from_id = a.id WHERE n.to_id = $1 AND n.partnership_id = $2 ORDER BY n.created_at DESC`, [account.id, account.partnership_id])).rows
  }
  if (e.method === 'POST') {
    const b = await readBody(e)
    const toId = b.to_id || account.partner_id
    if (!toId) throw createError({ statusCode: 400 })
    return (await query('INSERT INTO love_notes (partnership_id,from_id,to_id,message) VALUES ($1,$2,$3,$4) RETURNING *', [account.partnership_id, account.id, toId, b.message])).rows[0]
  }
  if (e.method === 'PATCH') {
    const { id, read } = await readBody(e)
    await query('UPDATE love_notes SET read = $1 WHERE id = $2 AND partnership_id = $3', [read, id, account.partnership_id])
    return { success: true }
  }
})
