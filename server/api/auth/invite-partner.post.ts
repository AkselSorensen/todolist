import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const account = event.context.account
  if (!account) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const { partnerEmail } = await readBody(event)
  if (!partnerEmail) {
    throw createError({ statusCode: 400, message: 'partnerEmail is required' })
  }

  const emailLower = partnerEmail.toLowerCase().trim()

  // Can't invite yourself
  if (emailLower === account.email) {
    throw createError({ statusCode: 400, message: 'You cannot partner with yourself' })
  }

  // Check if already partnered
  const me = await query('SELECT partnership_id, partner_id FROM accounts WHERE id = $1', [account.id])
  if (me.rows[0].partnership_id) {
    throw createError({ statusCode: 400, message: 'You already have a partner' })
  }

  // Find partner
  const partner = await query('SELECT id, partnership_id FROM accounts WHERE email = $1', [emailLower])
  if (partner.rows.length === 0) {
    throw createError({ statusCode: 404, message: 'No account found with this email. Ask them to create an account first!' })
  }

  const partnerRow = partner.rows[0]
  if (partnerRow.partnership_id) {
    throw createError({ statusCode: 400, message: 'This person already has a partner' })
  }

  // Create partnership
  const partnership = await query('INSERT INTO partnerships DEFAULT VALUES RETURNING id')
  const partnershipId = partnership.rows[0].id

  // Link both accounts
  await query(
    'UPDATE accounts SET partnership_id = $1, partner_id = $2 WHERE id = $3',
    [partnershipId, partnerRow.id, account.id]
  )
  await query(
    'UPDATE accounts SET partnership_id = $1, partner_id = $2 WHERE id = $3',
    [partnershipId, account.id, partnerRow.id]
  )

  // Assign partnership_id to existing data
  await query('UPDATE visited_countries SET partnership_id = $1 WHERE partnership_id IS NULL', [partnershipId])
  await query('UPDATE todos SET partnership_id = $1 WHERE partnership_id IS NULL', [partnershipId])
  await query('UPDATE calendar_events SET partnership_id = $1 WHERE partnership_id IS NULL', [partnershipId])
  await query('UPDATE todo_categories SET partnership_id = $1 WHERE partnership_id IS NULL', [partnershipId])

  // Create default categories for this partnership
  const existingCats = await query('SELECT COUNT(*) as c FROM todo_categories WHERE partnership_id = $1', [partnershipId])
  if (parseInt(existingCats.rows[0].c) === 0) {
    await query(`INSERT INTO todo_categories (name, icon, color, sort_order, partnership_id) VALUES 
      ('À faire', 'lucide:clipboard-list', '#f0c060', 1, $1),
      ('En cours', 'lucide:zap', '#4adec0', 2, $1),
      ('Acquis / Fait', 'lucide:check-circle', '#6fcf97', 3, $1),
      ('Rêves', 'lucide:sparkles', '#a78bfa', 4, $1)`,
      [partnershipId]
    )
  }

  // Return updated account
  const updated = await query(
    `SELECT a.id, a.email, a.name, a.color, a.partnership_id, a.partner_id,
            p.name as partner_name, p.color as partner_color, p.email as partner_email
     FROM accounts a LEFT JOIN accounts p ON a.partner_id = p.id WHERE a.id = $1`,
    [account.id]
  )

  const row = updated.rows[0]
  return {
    success: true,
    account: {
      id: row.id, email: row.email, name: row.name, color: row.color,
      partnership_id: row.partnership_id, partner_id: row.partner_id,
      partner: { id: row.partner_id, name: row.partner_name, color: row.partner_color, email: row.partner_email },
    }
  }
})
