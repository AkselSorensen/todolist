import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  if (e.method === 'GET') {
    const result = await query('SELECT country_name, visited_by FROM visited_countries ORDER BY created_at DESC')
    return result.rows
  }

  if (e.method === 'POST') {
    const { country, visited_by } = await readBody(e)
    if (!country) throw createError({ statusCode: 400, message: 'country required' })

    const exists = await query('SELECT id FROM visited_countries WHERE country_name = $1', [country])
    if (exists.rows.length > 0) {
      if (visited_by) {
        await query('UPDATE visited_countries SET visited_by = $1 WHERE country_name = $2', [visited_by, country])
        return { visited: true, visited_by }
      }
      await query('DELETE FROM visited_countries WHERE country_name = $1', [country])
      return { visited: false }
    } else {
      const by = visited_by || 'both'
      await query('INSERT INTO visited_countries (country_name, visited_by) VALUES ($1, $2)', [country, by])
      return { visited: true, visited_by: by }
    }
  }
})
