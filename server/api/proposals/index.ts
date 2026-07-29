import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    const result = await query(
      `SELECT t.*, a.name as from_name, a.color as from_color
       FROM trip_proposals t LEFT JOIN accounts a ON t.from_id = a.id
       WHERE t.partnership_id = $1 ORDER BY t.created_at DESC`,
      [account.partnership_id]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    const result = await query(
      `INSERT INTO trip_proposals (partnership_id, from_id, title, description, destination, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [account.partnership_id, account.id, b.title, b.description || '', b.destination || '', b.start_date || null, b.end_date || null]
    )
    const proposal = result.rows[0]

    // Notify partner
    await query(
      `INSERT INTO notifications (partnership_id, from_id, to_id, type, message, link)
       VALUES ($1,$2,$3,'trip','✈️ ${account.name} propose un voyage : ${b.title}','/moments')`,
      [account.partnership_id, account.id, account.partner_id]
    )

    return proposal
  }

  if (e.method === 'PATCH') {
    const { id, status } = await readBody(e)
    const result = await query(
      "UPDATE trip_proposals SET status = $1 WHERE id = $2 AND partnership_id = $3 AND status = 'pending' RETURNING *",
      [status, id, account.partnership_id]
    )
    if (result.rows.length === 0) throw createError({ statusCode: 404 })

    const p = result.rows[0]
    const emoji = status === 'accepted' ? '✅' : '❌'
    await query(
      `INSERT INTO notifications (partnership_id, from_id, to_id, type, message, link)
       VALUES ($1,$2,$3,'trip','${emoji} ${account.name} a ${status === 'accepted' ? 'accepté' : 'décliné'} : ${p.title}','/moments')`,
      [account.partnership_id, account.id, p.from_id]
    )

    return p
  }

  if (e.method === 'DELETE') {
    await query('DELETE FROM trip_proposals WHERE id = $1 AND partnership_id = $2', [getQuery(e).id, account.partnership_id])
    return { success: true }
  }
})
