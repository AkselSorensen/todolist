import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const account = await getCurrentAccount(event)

  const { partnerEmail } = await readBody(event)
  if (!partnerEmail) throw createError({ statusCode: 400, message: 'partnerEmail required' })

  const emailLower = partnerEmail.toLowerCase().trim()
  if (emailLower === account.email) throw createError({ statusCode: 400, message: 'Cannot partner with yourself' })
  if (account.partnership_id) throw createError({ statusCode: 400, message: 'Already have a partner' })

  const partner = await query('SELECT id, partnership_id FROM accounts WHERE email = $1', [emailLower])
  if (partner.rows.length === 0) throw createError({ statusCode: 404, message: 'No account found. Ask them to register first!' })
  if (partner.rows[0].partnership_id) throw createError({ statusCode: 400, message: 'This person already has a partner' })

  const pship = await query('INSERT INTO partnerships DEFAULT VALUES RETURNING id')
  const pid = pship.rows[0].id

  await query('UPDATE accounts SET partnership_id = $1, partner_id = $2 WHERE id = $3', [pid, partner.rows[0].id, account.id])
  await query('UPDATE accounts SET partnership_id = $1, partner_id = $2 WHERE id = $3', [pid, account.id, partner.rows[0].id])

  // Assign existing unowned data to this partnership
  await query('UPDATE visited_countries SET partnership_id = $1 WHERE partnership_id IS NULL', [pid])
  await query('UPDATE todos SET partnership_id = $1 WHERE partnership_id IS NULL', [pid])
  await query('UPDATE calendar_events SET partnership_id = $1 WHERE partnership_id IS NULL', [pid])
  await query('UPDATE todo_categories SET partnership_id = $1 WHERE partnership_id IS NULL', [pid])

  // Create default categories if none
  const ec = await query('SELECT COUNT(*) as c FROM todo_categories WHERE partnership_id = $1', [pid])
  if (parseInt(ec.rows[0].c) === 0) {
    await query(`INSERT INTO todo_categories (name, icon, color, sort_order, partnership_id) VALUES
      ('À faire','lucide:clipboard-list','#f0c060',1,$1),('En cours','lucide:zap','#4adec0',2,$1),
      ('Acquis / Fait','lucide:check-circle','#6fcf97',3,$1),('Rêves','lucide:sparkles','#a78bfa',4,$1)`, [pid])
  }

  // Refetch fresh account
  const fresh = await getCurrentAccount(event)
  return { success: true, account: fresh }
})
