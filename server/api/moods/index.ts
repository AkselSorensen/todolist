import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    const target = (getQuery(e).date as string) || new Date().toISOString().split('T')[0]
    return (await query(
      `SELECT m.*, a.name, a.color FROM daily_moods m LEFT JOIN accounts a ON m.account_id = a.id WHERE m.partnership_id = $1 AND m.date = $2 ORDER BY m.account_id`,
      [account.partnership_id, target]
    )).rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    const today = new Date().toISOString().split('T')[0]
    const existing = await query(
      'SELECT id, mood FROM daily_moods WHERE account_id = $1 AND date = $2',
      [account.id, today]
    )
    const result = await query(
      `INSERT INTO daily_moods (partnership_id, account_id, mood, date) VALUES ($1,$2,$3,$4)
       ON CONFLICT (account_id, date) DO UPDATE SET mood = $3 RETURNING *`,
      [account.partnership_id, account.id, b.mood, today]
    )

    // Notify partner if mood changed
    if (account.partner_id && (existing.rows.length === 0 || existing.rows[0].mood !== b.mood)) {
      const labels: Record<string, string> = { '😍': 'Amoureux(se)', '😊': 'Content(e)', '🤪': 'Joueur(se)', '🥱': 'Fatigué(e)', '😤': 'Stressé(e)', '🥺': 'Nostalgique', '😴': 'Envie de rien' }
      await query(
        `INSERT INTO notifications (partnership_id, from_id, to_id, type, message, link)
         VALUES ($1,$2,$3,'mood','${b.mood} ${account.name} se sent ${labels[b.mood] || b.mood}','/moments')`,
        [account.partnership_id, account.id, account.partner_id]
      )
    }

    return result.rows[0]
  }
})
