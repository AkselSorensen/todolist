import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    return (await query(`SELECT g.*, a.name as cn, a.color as cc FROM gift_ideas g LEFT JOIN accounts a ON g.created_by = a.id WHERE g.partnership_id = $1 AND (g.surprise = false OR g.created_by = $2) ORDER BY g.created_at DESC`, [account.partnership_id, account.id])).rows
  }
  if (e.method === 'POST') {
    const b = await readBody(e)
    return (await query('INSERT INTO gift_ideas (partnership_id,created_by,title,link,notes,surprise) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [account.partnership_id, account.id, b.title, b.link || '', b.notes || '', b.surprise || false])).rows[0]
  }
  if (e.method === 'PATCH') {
    const { id, ...b } = await readBody(e)
    const fields: string[] = []; const params: any[] = []; let i = 1
    for (const [k, v] of Object.entries(b)) {
      if (['title','link','notes','surprise'].includes(k)) { fields.push(`${k} = $${i++}`); params.push(v) }
    }
    if (!fields.length) throw createError({ statusCode: 400 })
    params.push(id, account.partnership_id)
    await query(`UPDATE gift_ideas SET ${fields.join(', ')} WHERE id = $${i++} AND partnership_id = $${i++}`, params)
    return { success: true }
  }
  if (e.method === 'DELETE') {
    await query('DELETE FROM gift_ideas WHERE id = $1 AND partnership_id = $2', [getQuery(e).id, account.partnership_id])
    return { success: true }
  }
})
