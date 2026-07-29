import { query } from '../utils/db'

export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const result = await query(
    `SELECT a.id, a.name, a.color, a.email
     FROM accounts a
     WHERE a.partnership_id = $1
     ORDER BY a.id`,
    [account.partnership_id]
  )
  return result.rows
})
