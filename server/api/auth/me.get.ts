import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const account = event.context.account
  if (!account) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  // Get account with partner info
  const result = await query(
    `SELECT a.id, a.email, a.name, a.color, a.partnership_id, a.partner_id,
            p.name as partner_name, p.color as partner_color, p.email as partner_email
     FROM accounts a
     LEFT JOIN accounts p ON a.partner_id = p.id
     WHERE a.id = $1`,
    [account.id]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Account not found' })
  }

  const row = result.rows[0]
  return {
    account: {
      id: row.id,
      email: row.email,
      name: row.name,
      color: row.color,
      partnership_id: row.partnership_id,
      partner_id: row.partner_id,
      partner: row.partner_id ? {
        id: row.partner_id,
        name: row.partner_name,
        color: row.partner_color,
        email: row.partner_email,
      } : null,
    }
  }
})
