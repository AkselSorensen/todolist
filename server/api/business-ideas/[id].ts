import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessIdeasTable, IDEA_MONEY, IDEA_STAGES, IDEA_EFFORTS, IDEA_FIELDS } from '../../utils/businessIdeas'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessIdeasTable()

  const id = Number(getRouterParam(e, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid id' })

  if (e.method === 'GET') {
    const r = await query(
      `SELECT i.id, i.title, i.pitch, i.stage, i.effort, i.next_step, i.link,
              i.partnership_id, i.created_by, i.created_at, i.updated_at, ${IDEA_MONEY}
       FROM business_ideas i
       WHERE i.id = $1 AND i.partnership_id = $2`, [id, account.partnership_id])
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Idea not found' })
    const idea = r.rows[0]
    idea.tasks = (await query(
      'SELECT id, idea_id, label, done, position FROM business_idea_tasks WHERE idea_id = $1 ORDER BY position ASC, id ASC',
      [id])).rows
    return idea
  }

  if (e.method === 'PATCH') {
    const body = await readBody(e) || {}
    const sets: string[] = []
    const params: any[] = []
    for (const [k, v] of Object.entries(body)) {
      if (!IDEA_FIELDS.includes(k)) continue
      if (k === 'stage' && !IDEA_STAGES.includes(v as any)) continue
      if (k === 'effort' && !IDEA_EFFORTS.includes(v as any)) continue
      if (k === 'title' && !String(v || '').trim()) continue
      if (['invested', 'monthly_target', 'earned'].includes(k)) {
        params.push(Number.isFinite(+v) ? Math.max(0, +v) : 0)
        sets.push(`${k} = $${params.length}`)
        continue
      }
      params.push(v)
      sets.push(`${k} = $${params.length}`)
    }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    const idParam = params.push(id)
    const pidParam = params.push(account.partnership_id)
    sets.push('updated_at = NOW()')
    const r = await query(
      `UPDATE business_ideas SET ${sets.join(', ')} WHERE id = $${idParam} AND partnership_id = $${pidParam} RETURNING id`,
      params
    )
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Idea not found' })
    return { success: true, id }
  }

  if (e.method === 'DELETE') {
    // les tâches partent en cascade
    const r = await query('DELETE FROM business_ideas WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    if (r.rowCount === 0) throw createError({ statusCode: 404, message: 'Idea not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
