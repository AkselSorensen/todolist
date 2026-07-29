import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const pid = account.partnership_id

  if (e.method === 'GET') {
    const result = await query(
      `SELECT m.*, a.name as creator_name FROM memories m
       LEFT JOIN accounts a ON m.created_by = a.id
       WHERE m.partnership_id = $1 ORDER BY m.date DESC`,
      [pid]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const body = await readBody(e)
    const result = await query(
      `INSERT INTO memories (partnership_id, title, date, description, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [pid, body.title, body.date, body.description || '', account.id]
    )
    return result.rows[0]
  }

  if (e.method === 'DELETE') {
    const { id } = getQuery(e)
    await query('DELETE FROM memories WHERE id = $1 AND partnership_id = $2', [id, pid])
    return { success: true }
  }
})
