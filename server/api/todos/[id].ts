import { query } from '../../utils/db'

// GET single todo
export default defineEventHandler(async (e) => {
  const id = getRouterParam(e, 'id')
  const method = e.method

  if (method === 'GET') {
    const result = await query(
      `SELECT t.*, 
        tc.name as category_name, tc.icon as category_icon, tc.color as category_color,
        u_creator.name as creator_name, u_assign.name as assignee_name
      FROM todos t
      LEFT JOIN todo_categories tc ON t.category_id = tc.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      LEFT JOIN users u_assign ON t.assigned_to = u_assign.id
      WHERE t.id = $1`,
      [id]
    )
    if (result.rows.length === 0) throw createError({ statusCode: 404, message: 'Todo not found' })
    return result.rows[0]
  }

  // PATCH update todo
  if (method === 'PATCH') {
    const body = await readBody(e)
    const fields: string[] = []
    const params: any[] = []
    let i = 1

    for (const [key, val] of Object.entries(body)) {
      const allowed = ['title', 'description', 'category_id', 'assigned_to', 'priority', 'status', 'completed_at']
      if (allowed.includes(key)) {
        fields.push(`${key} = $${i++}`)
        params.push(key === 'completed_at' && val === 'now' ? new Date().toISOString() : val)
      }
    }
    
    if (fields.length === 0) throw createError({ statusCode: 400, message: 'No valid fields' })
    
    fields.push(`updated_at = $${i++}`)
    params.push(new Date().toISOString())
    params.push(id)

    const result = await query(
      `UPDATE todos SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )
    return result.rows[0]
  }

  // DELETE todo
  if (method === 'DELETE') {
    await query('DELETE FROM todos WHERE id = $1', [id])
    return { success: true }
  }
})
