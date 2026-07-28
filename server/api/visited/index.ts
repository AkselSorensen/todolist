import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  // GET: list all visited countries
  if (e.method === 'GET') {
    const result = await query('SELECT country_name FROM visited_countries ORDER BY created_at DESC')
    return result.rows.map((r: any) => r.country_name)
  }

  // POST: toggle a country (body: { country: "France" })
  if (e.method === 'POST') {
    const { country } = await readBody(e)
    if (!country) throw createError({ statusCode: 400, message: 'country required' })

    const exists = await query('SELECT id FROM visited_countries WHERE country_name = $1', [country])
    if (exists.rows.length > 0) {
      await query('DELETE FROM visited_countries WHERE country_name = $1', [country])
      return { visited: false }
    } else {
      await query('INSERT INTO visited_countries (country_name) VALUES ($1)', [country])
      return { visited: true }
    }
  }
})
