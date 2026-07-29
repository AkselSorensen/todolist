import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    // Get unread notifications for me
    const result = await query(
      `SELECT n.*, a.name as from_name, a.color as from_color
       FROM notifications n LEFT JOIN accounts a ON n.from_id = a.id
       WHERE n.to_id = $1 AND n.partnership_id = $2
       ORDER BY n.created_at DESC LIMIT 30`,
      [account.id, account.partnership_id]
    )
    return result.rows
  }

  if (e.method === 'PATCH') {
    const { id, read_all } = await readBody(e)
    if (read_all) {
      await query('UPDATE notifications SET read = true WHERE to_id = $1 AND partnership_id = $2', [account.id, account.partnership_id])
    } else if (id) {
      await query('UPDATE notifications SET read = true WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    }
    return { success: true }
  }
})
