import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessAssetsTable, ASSET_CATEGORIES, ASSET_FIELDS } from '../../utils/businessAssets'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessAssetsTable()

  const id = Number(getRouterParam(e, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Invalid id' })

  if (e.method === 'GET') {
    const r = await query(
      `SELECT a.id, a.name, a.category, a.notes, a.owner_id, a.created_at, a.updated_at,
              a.value::float8 AS value, a.quantity::float8 AS quantity
       FROM business_assets a WHERE a.id = $1 AND a.partnership_id = $2`,
      [id, account.partnership_id])
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Asset not found' })
    return r.rows[0]
  }

  if (e.method === 'PATCH') {
    const body = await readBody(e) || {}
    const sets: string[] = []
    const params: any[] = []
    for (const [k, v] of Object.entries(body)) {
      if (!ASSET_FIELDS.includes(k)) continue
      if (k === 'category' && !ASSET_CATEGORIES.includes(v as any)) continue
      if (k === 'name' && !String(v || '').trim()) continue
      if (k === 'owner_id') {
        // owner_id null / 0 / '' => bien commun
        const oid = Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null
        params.push(oid); sets.push(`owner_id = $${params.length}`); continue
      }
      if (k === 'value') { params.push(Number.isFinite(+v) ? Math.max(0, +v) : 0); sets.push(`value = $${params.length}`); continue }
      if (k === 'quantity') {
        const q = Number.isFinite(+v) && +v > 0 ? +v : null
        params.push(q); sets.push(`quantity = $${params.length}`); continue
      }
      params.push(v)
      sets.push(`${k} = $${params.length}`)
    }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    const idParam = params.push(id)
    const pidParam = params.push(account.partnership_id)
    sets.push('updated_at = NOW()')
    const r = await query(
      `UPDATE business_assets SET ${sets.join(', ')} WHERE id = $${idParam} AND partnership_id = $${pidParam} RETURNING id`,
      params)
    if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Asset not found' })
    return { success: true, id }
  }

  if (e.method === 'DELETE') {
    const r = await query('DELETE FROM business_assets WHERE id = $1 AND partnership_id = $2', [id, account.partnership_id])
    if (r.rowCount === 0) throw createError({ statusCode: 404, message: 'Asset not found' })
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
