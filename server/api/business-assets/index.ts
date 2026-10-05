import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessAssetsTable, ASSET_MONEY, ASSET_CATEGORIES } from '../../utils/businessAssets'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessAssetsTable()

  if (e.method === 'GET') {
    const { category, owner } = getQuery(e)
    let sql = `
      SELECT a.id, a.name, a.category, a.notes, a.owner_id, a.created_at, a.updated_at, ${ASSET_MONEY},
             o.name as owner_name, o.color as owner_color
      FROM business_assets a
      LEFT JOIN accounts o ON a.owner_id = o.id
      WHERE a.partnership_id = $1
    `
    const params: any[] = [account.partnership_id]
    if (category) { params.push(category); sql += ` AND a.category = $${params.length}` }
    if (owner === 'common') sql += ' AND a.owner_id IS NULL'
    else if (owner) { params.push(Number(owner)); sql += ` AND a.owner_id = $${params.length}` }
    // regroupement par propriétaire puis plus grosse ligne d'abord
    sql += ' ORDER BY a.owner_id NULLS LAST, a.value DESC, a.id ASC'
    return (await query(sql, params)).rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    if (!b?.name || !String(b.name).trim()) {
      throw createError({ statusCode: 400, message: 'name is required' })
    }
    const category = ASSET_CATEGORIES.includes(b.category) ? b.category : 'other'
    const ownerId = Number.isInteger(Number(b.owner_id)) && Number(b.owner_id) > 0 ? Number(b.owner_id) : null
    const num = (v: any) => (Number.isFinite(+v) ? Math.max(0, +v) : 0)
    const qty = Number.isFinite(+b.quantity) && +b.quantity > 0 ? +b.quantity : null
    const r = await query(
      `INSERT INTO business_assets (partnership_id, owner_id, name, category, value, quantity, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, category, notes, owner_id, created_at, updated_at, value::float8 AS value, quantity::float8 AS quantity`,
      [account.partnership_id, ownerId, String(b.name).trim(), category, num(b.value), qty, b.notes || '', account.id]
    )
    return r.rows[0]
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
