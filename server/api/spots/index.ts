import { query } from '../../utils/db'

export default defineEventHandler(async (e) => {
  const account = e.context.account
  if (!account) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const pid = account.partnership_id

  if (e.method === 'GET') {
    const result = await query(
      'SELECT * FROM date_spots WHERE partnership_id = $1 ORDER BY created_at DESC',
      [pid]
    )
    return result.rows
  }

  if (e.method === 'POST') {
    const body = await readBody(e)
    const result = await query(
      `INSERT INTO date_spots (partnership_id, name, category, rating, notes, visited, lat, lng, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [pid, body.name, body.category || 'restaurant', body.rating || null, body.notes || '', body.visited || false, body.lat || null, body.lng || null, account.id]
    )
    return result.rows[0]
  }

  if (e.method === 'PATCH') {
    const { id, ...body } = await readBody(e)
    const fields: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(body)) {
      if (['name', 'category', 'rating', 'notes', 'visited', 'lat', 'lng'].includes(k)) {
        fields.push(`${k} = $${i++}`)
        params.push(v)
      }
    }
    if (fields.length === 0) throw createError({ statusCode: 400, message: 'No valid fields' })
    params.push(id, pid)
    const result = await query(`UPDATE date_spots SET ${fields.join(', ')} WHERE id = $${i++} AND partnership_id = $${i++} RETURNING *`, params)
    return result.rows[0]
  }

  if (e.method === 'DELETE') {
    const { id } = getQuery(e)
    await query('DELETE FROM date_spots WHERE id = $1 AND partnership_id = $2', [id, pid])
    return { success: true }
  }
})
