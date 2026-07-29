import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  const id = getRouterParam(e, 'id')
  const method = e.method

  if (method === 'GET') {
    const r = await query(
      `SELECT t.*, tc.name as cn, tc.icon as ci, tc.color as cc, uc.name as crn, ua.name as an
       FROM todos t LEFT JOIN todo_categories tc ON t.category_id = tc.id
       LEFT JOIN accounts uc ON t.created_by = uc.id LEFT JOIN accounts ua ON t.assigned_to = ua.id
       WHERE t.id = $1 AND t.partnership_id = $2`, [id, account.partnership_id])
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Todo not found' })
    return r.rows[0]
  }

  if (method === 'PATCH') {
    const body = await readBody(e)
    const fields: string[] = []; const params: any[] = []; let i = 1
    for (const [k, v] of Object.entries(body)) {
      if (['title','description','category_id','assigned_to','priority','status','completed_at'].includes(k)) {
        fields.push(`${k} = $${i++}`); params.push(k === 'completed_at' && v === 'now' ? new Date().toISOString() : v)
      }
    }
    if (fields.length === 0) throw createError({ statusCode: 400 })
    fields.push(`updated_at = $${i++}`); params.push(new Date().toISOString()); params.push(id); params.push(account.partnership_id)
    const r = await query(`UPDATE todos SET ${fields.join(', ')} WHERE id = $${i++} AND partnership_id = $${i++} RETURNING *`, params)
    if (r.rows.length === 0) throw createError({ statusCode: 404 })
    return r.rows[0]
  }

  if (method === 'DELETE') {
    const r = await query('DELETE FROM todos WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    if (r.rowCount === 0) throw createError({ statusCode: 404 })
    return { success: true }
  }
})
