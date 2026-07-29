import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    return (await query(`SELECT m.*, a.name as cn FROM memories m LEFT JOIN accounts a ON m.created_by = a.id WHERE m.partnership_id = $1 ORDER BY m.date DESC`, [account.partnership_id])).rows
  }
  if (e.method === 'POST') {
    const b = await readBody(e)
    return (await query('INSERT INTO memories (partnership_id,title,date,description,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [account.partnership_id, b.title, b.date, b.description || '', account.id])).rows[0]
  }
  if (e.method === 'DELETE') {
    await query('DELETE FROM memories WHERE id = $1 AND partnership_id = $2', [getQuery(e).id, account.partnership_id])
    return { success: true }
  }
})
