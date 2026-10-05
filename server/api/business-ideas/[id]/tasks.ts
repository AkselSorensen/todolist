import { query } from '../../../utils/db'
import { getCurrentAccount } from '../../../utils/auth'
import { ensureBusinessIdeasTable } from '../../../utils/businessIdeas'

// Checklist « quoi faire » d'une idée : POST (ajouter), PATCH (cocher/renommer), DELETE.
export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessIdeasTable()

  const ideaId = Number(getRouterParam(e, 'id'))
  if (!Number.isInteger(ideaId)) throw createError({ statusCode: 400, message: 'Invalid id' })

  const owned = async () => (await query(
    'SELECT id FROM business_ideas WHERE id = $1 AND partnership_id = $2',
    [ideaId, account.partnership_id])).rows.length > 0

  if (e.method === 'GET') {
    if (!await owned()) throw createError({ statusCode: 404, message: 'Idea not found' })
    return (await query(
      'SELECT id, idea_id, label, done, position FROM business_idea_tasks WHERE idea_id = $1 ORDER BY position ASC, id ASC',
      [ideaId])).rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    if (!b?.label || !String(b.label).trim()) throw createError({ statusCode: 400, message: 'label is required' })
    if (!await owned()) throw createError({ statusCode: 404, message: 'Idea not found' })
    const pos = (await query('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM business_idea_tasks WHERE idea_id = $1', [ideaId])).rows[0].p
    return (await query(
      'INSERT INTO business_idea_tasks (idea_id, label, position) VALUES ($1,$2,$3) RETURNING id, idea_id, label, done, position',
      [ideaId, String(b.label).trim(), pos])).rows[0]
  }

  if (e.method === 'PATCH') {
    const b = await readBody(e) || {}
    const taskId = Number(b.id)
    if (!Number.isInteger(taskId)) throw createError({ statusCode: 400, message: 'Invalid task id' })
    const sets: string[] = []
    const params: any[] = []
    if (typeof b.done === 'boolean') { params.push(b.done); sets.push(`done = $${params.length}`) }
    if (b.label !== undefined && String(b.label).trim()) { params.push(String(b.label).trim()); sets.push(`label = $${params.length}`) }
    if (Number.isFinite(+b.position)) { params.push(+b.position); sets.push(`position = $${params.length}`) }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    params.push(taskId, ideaId)
    const r = await query(
      `UPDATE business_idea_tasks SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND idea_id = $${params.length}
       RETURNING id, idea_id, label, done, position`, params)
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Task not found' })
    return r.rows[0]
  }

  if (e.method === 'DELETE') {
    const taskId = Number(getQuery(e).id)
    if (!Number.isInteger(taskId)) throw createError({ statusCode: 400, message: 'Invalid task id' })
    const r = await query('DELETE FROM business_idea_tasks WHERE id = $1 AND idea_id = $2', [taskId, ideaId])
    if (r.rowCount === 0) throw createError({ statusCode: 404, message: 'Task not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
