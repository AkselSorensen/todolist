import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  const method = e.method

  if (method === 'GET') {
    const { category, status, assigned } = getQuery(e)
    let sql = `
      SELECT t.*, tc.name as cn, tc.icon as ci, tc.color as cc,
        uc.name as crn, uc.color as crc, ua.name as an, ua.color as ac
      FROM todos t
      LEFT JOIN todo_categories tc ON t.category_id = tc.id
      LEFT JOIN accounts uc ON t.created_by = uc.id
      LEFT JOIN accounts ua ON t.assigned_to = ua.id
      WHERE t.partnership_id = $1
    `
    const params: any[] = [account.partnership_id]
    let i = 2
    if (category) { sql += ` AND tc.name = $${i++}`; params.push(category) }
    if (status) { sql += ` AND t.status = $${i++}`; params.push(status) }
    if (assigned) { sql += ` AND ua.name = $${i++}`; params.push(assigned) }
    sql += ' ORDER BY t.priority DESC, t.created_at DESC'
    const result = await query(sql, params)
    return result.rows
  }

  if (method === 'POST') {
    const body = await readBody(e)
    const r = await query(
      `INSERT INTO todos (title, description, category_id, created_by, assigned_to, priority, status, partnership_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.title, body.description || '', body.category_id || null, account.id,
       body.assigned_to || null, body.priority || 'medium', body.status || 'todo', account.partnership_id]
    )
    return r.rows[0]
  }
})
