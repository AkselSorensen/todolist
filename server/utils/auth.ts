import { query } from './db'

// Fetch fresh account from DB (for getCurrentAccount compatibility)
export async function getCurrentAccount(event: any) {
  const jwt = event.context.account
  if (!jwt) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const r = await query(
    `SELECT a.id, a.email, a.name, a.color, a.partnership_id, a.partner_id,
            p.name as pn, p.color as pc, p.email as pe
     FROM accounts a LEFT JOIN accounts p ON a.partner_id = p.id WHERE a.id = $1`,
    [jwt.id]
  )
  if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Account not found' })
  const row = r.rows[0]
  return {
    id: row.id, email: row.email, name: row.name, color: row.color,
    partnership_id: row.partnership_id, partner_id: row.partner_id,
    partner: row.partner_id ? { id: row.partner_id, name: row.pn, color: row.pc, email: row.pe } : null,
  }
}
