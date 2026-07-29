import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const pid = account.partnership_id

  if (e.method === 'GET') {
    const { date } = getQuery(e)
    // Get both partners' moods for a date (default today)
    const targetDate = (date as string) || new Date().toISOString().split('T')[0]
    const result = await query(
      `SELECT m.*, a.name, a.color FROM daily_moods m
       LEFT JOIN accounts a ON m.account_id = a.id
       WHERE m.partnership_id = $1 AND m.date = $2
       ORDER BY m.account_id`,
      [pid, targetDate]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const body = await readBody(e)
    const today = new Date().toISOString().split('T')[0]
    const result = await query(
      `INSERT INTO daily_moods (partnership_id, account_id, mood, date)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (account_id, date) DO UPDATE SET mood = $3
       RETURNING *`,
      [pid, account.id, body.mood, today]
    )
    return result.rows[0]
  }
})
