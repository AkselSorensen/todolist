import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const pid = account.partnership_id

  if (e.method === 'GET') {
    // Show gifts created by me AND gifts created by my partner (unless surprise)
    const result = await query(
      `SELECT g.*, a.name as creator_name, a.color as creator_color FROM gift_ideas g
       LEFT JOIN accounts a ON g.created_by = a.id
       WHERE g.partnership_id = $1
       AND (g.surprise = false OR g.created_by = $2)
       ORDER BY g.created_at DESC`,
      [pid, account.id]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const body = await readBody(e)
    const result = await query(
      `INSERT INTO gift_ideas (partnership_id, created_by, title, link, notes, surprise) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [pid, account.id, body.title, body.link || '', body.notes || '', body.surprise || false]
    )
    return result.rows[0]
  }

  if (e.method === 'PATCH') {
    const { id, ...body } = await readBody(e)
    const fields: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(body)) {
      if (['title', 'link', 'notes', 'surprise'].includes(k)) {
        fields.push(`${k} = $${i++}`)
        params.push(v)
      }
    }
    if (fields.length === 0) throw createError({ statusCode: 400 })
    params.push(id, pid)
    await query(`UPDATE gift_ideas SET ${fields.join(', ')} WHERE id = $${i++} AND partnership_id = $${i++}`, params)
    return { success: true }
  }

  if (e.method === 'DELETE') {
    const { id } = getQuery(e)
    await query('DELETE FROM gift_ideas WHERE id = $1 AND partnership_id = $2', [id, pid])
    return { success: true }
  }
})
