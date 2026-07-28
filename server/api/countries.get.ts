import { query } from '../../utils/db'

export default defineEventHandler(async () => {
  const result = await query('SELECT name, en_name as en, lat, lng, continent, emoji FROM countries ORDER BY name')
  return result.rows
})
