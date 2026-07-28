import { query } from '../utils/db'

export default defineEventHandler(async (e) => {
  const result = await query('SELECT id, name, color FROM users ORDER BY id')
  return result.rows
})
