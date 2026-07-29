import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    return (await query('SELECT * FROM date_spots WHERE partnership_id = $1 ORDER BY created_at DESC', [account.partnership_id])).rows
  }
  if (e.method === 'POST') {
    const b = await readBody(e)
    return (await query(`INSERT INTO date_spots (partnership_id,name,category,rating,notes,visited,lat,lng,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [account.partnership_id, b.name, b.category || 'restaurant', b.rating || null, b.notes || '', b.visited || false, b.lat || null, b.lng || null, account.id])).rows[0]
  }
  if (e.method === 'PATCH') {
    const { id, ...b } = await readBody(e)
    const fields: string[] = []; const params: any[] = []; let i = 1
    for (const [k, v] of Object.entries(b)) {
      if (['name','category','rating','notes','visited','lat','lng'].includes(k)) { fields.push(`${k} = $${i++}`); params.push(v) }
    }
    if (!fields.length) throw createError({ statusCode: 400 })
    params.push(id, account.partnership_id)
    return (await query(`UPDATE date_spots SET ${fields.join(', ')} WHERE id = $${i++} AND partnership_id = $${i++} RETURNING *`, params)).rows[0]
  }
  if (e.method === 'DELETE') {
    await query('DELETE FROM date_spots WHERE id = $1 AND partnership_id = $2', [getQuery(e).id, account.partnership_id])
    return { success: true }
  }
})
