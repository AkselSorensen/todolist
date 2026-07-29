import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    const target = (getQuery(e).date as string) || new Date().toISOString().split('T')[0]
    return (await query(`SELECT m.*, a.name, a.color FROM daily_moods m LEFT JOIN accounts a ON m.account_id = a.id WHERE m.partnership_id = $1 AND m.date = $2 ORDER BY m.account_id`, [account.partnership_id, target])).rows
  }
  if (e.method === 'POST') {
    const b = await readBody(e)
    const today = new Date().toISOString().split('T')[0]
    return (await query(`INSERT INTO daily_moods (partnership_id,account_id,mood,date) VALUES ($1,$2,$3,$4) ON CONFLICT (account_id,date) DO UPDATE SET mood = $3 RETURNING *`, [account.partnership_id, account.id, b.mood, today])).rows[0]
  }
})
