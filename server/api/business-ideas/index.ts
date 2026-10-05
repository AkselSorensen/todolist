import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessIdeasTable, IDEA_MONEY, IDEA_STAGES, IDEA_EFFORTS } from '../../utils/businessIdeas'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessIdeasTable()

  if (e.method === 'GET') {
    const { stage } = getQuery(e)
    let sql = `
      SELECT i.id, i.title, i.pitch, i.stage, i.effort, i.next_step, i.link,
             i.partnership_id, i.created_by, i.created_at, i.updated_at,
             ${IDEA_MONEY},
             a.name as owner_name, a.color as owner_color
      FROM business_ideas i
      LEFT JOIN accounts a ON i.created_by = a.id
      WHERE i.partnership_id = $1
    `
    const params: any[] = [account.partnership_id]
    if (stage) { params.push(stage); sql += ` AND i.stage = $${params.length}` }
    sql += ' ORDER BY i.created_at DESC'

    const ideas = (await query(sql, params)).rows

    // Les tâches sont renvoyées groupées avec les idées : une seule requête, pas de N+1 côté page
    const tasks = (await query(
      `SELECT t.id, t.idea_id, t.label, t.done, t.position
       FROM business_idea_tasks t
       JOIN business_ideas i ON t.idea_id = i.id
       WHERE i.partnership_id = $1
       ORDER BY t.position ASC, t.id ASC`, [account.partnership_id])).rows

    const byIdea: Record<number, any[]> = {}
    for (const t of tasks) (byIdea[t.idea_id] ||= []).push(t)
    for (const i of ideas) i.tasks = byIdea[i.id] || []

    return ideas
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    if (!b?.title || !String(b.title).trim()) {
      throw createError({ statusCode: 400, message: 'title is required' })
    }
    const stage = IDEA_STAGES.includes(b.stage) ? b.stage : 'idea'
    const effort = IDEA_EFFORTS.includes(b.effort) ? b.effort : 'medium'
    const num = (v: any) => (Number.isFinite(+v) ? Math.max(0, +v) : 0)
    const r = await query(
      `INSERT INTO business_ideas
         (partnership_id, created_by, title, pitch, stage, effort, invested, monthly_target, earned, next_step, link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, pitch, stage, effort, next_step, link, partnership_id, created_by, created_at, updated_at, ${IDEA_MONEY}`,
      [
        account.partnership_id, account.id, String(b.title).trim(), b.pitch || '', stage, effort,
        num(b.invested), num(b.monthly_target), num(b.earned), b.next_step || '', b.link || '',
      ]
    )
    const idea = r.rows[0]
    idea.tasks = []
    return idea
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
