import { query } from '../utils/db'

export default defineEventHandler(async (e) => {
  if (e.method === 'GET') {
    const result = await query('SELECT name, en_name as en, lat, lng, continent, emoji, COALESCE(attractions,\'\') as attractions FROM countries ORDER BY name')
    return result.rows
  }
  if (e.method === 'POST') {
    const body = await readBody(e)
    const result = await query(
      'INSERT INTO countries (name, en_name, lat, lng, continent, emoji, attractions) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (name) DO UPDATE SET en_name=$2, lat=$3, lng=$4, continent=$5, emoji=$6 RETURNING *',
      [body.name, body.en_name, body.lat, body.lng, body.continent, body.emoji, body.attractions || '']
    )
    return result.rows[0]
  }
})
