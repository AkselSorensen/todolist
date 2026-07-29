import { query } from '../../utils/db'

// GET all todos
export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const method = e.method
  
  if (method === 'GET') {
    const { category, status, assigned } = getQuery(e)
    let sql = `
      SELECT t.*, 
        tc.name as category_name, tc.icon as category_icon, tc.color as category_color,
        u_creator.name as creator_name, u_creator.color as creator_color,
        u_assign.name as assignee_name, u_assign.color as assignee_color
      FROM todos t
      LEFT JOIN todo_categories tc ON t.category_id = tc.id
      LEFT JOIN accounts u_creator ON t.created_by = u_creator.id
      LEFT JOIN accounts u_assign ON t.assigned_to = u_assign.id
      WHERE t.partnership_id = $1
    `
    const params: any[] = [account.partnership_id]
    let i = 2
    
    if (category) { sql += ` AND tc.name = $${i++}`; params.push(category) }
    if (status) { sql += ` AND t.status = $${i++}`; params.push(status) }
    if (assigned) { sql += ` AND u_assign.name = $${i++}`; params.push(assigned) }
    
    sql += ' ORDER BY t.priority DESC, t.created_at DESC'
    
    const result = await query(sql, params)
    return result.rows
  }

  // POST create todo
  if (method === 'POST') {
    const body = await readBody(e)
    const { title, description, category_id, assigned_to, priority, status } = body
    
    const result = await query(
      `INSERT INTO todos (title, description, category_id, created_by, assigned_to, priority, status, partnership_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description || '', category_id || null, account.id, assigned_to || null, priority || 'medium', status || 'todo', account.partnership_id]
    )
    return result.rows[0]
  }
})
