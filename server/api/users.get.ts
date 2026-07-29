import { query } from '../utils/db'
import { getCurrentAccount } from '../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  const result = await query(
    'SELECT id, name, color, email FROM accounts WHERE partnership_id = $1 ORDER BY id',
    [account.partnership_id]
  )
  return result.rows
})
