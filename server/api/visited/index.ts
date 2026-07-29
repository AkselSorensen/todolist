import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    const result = await query(
      'SELECT country_name, visited_by FROM visited_countries WHERE partnership_id = $1 ORDER BY created_at DESC',
      [account.partnership_id]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const { country, visited_by } = await readBody(e)
    if (!country) throw createError({ statusCode: 400, message: 'country required' })

    const exists = await query(
      'SELECT id FROM visited_countries WHERE country_name = $1 AND partnership_id = $2',
      [country, account.partnership_id]
    )
    if (exists.rows.length > 0) {
      if (visited_by) {
        await query('UPDATE visited_countries SET visited_by = $1 WHERE country_name = $2 AND partnership_id = $3',
          [visited_by, country, account.partnership_id])
        return { visited: true, visited_by }
      }
      await query('DELETE FROM visited_countries WHERE country_name = $1 AND partnership_id = $2',
        [country, account.partnership_id])
      return { visited: false }
    } else {
      const by = visited_by || 'both'
      await query('INSERT INTO visited_countries (country_name, visited_by, partnership_id) VALUES ($1,$2,$3)',
        [country, by, account.partnership_id])
      return { visited: true, visited_by: by }
    }
  }
})
