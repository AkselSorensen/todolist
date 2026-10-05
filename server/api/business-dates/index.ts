import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessDatesTable, BUSINESS_KINDS, BUSINESS_STATUSES } from '../../utils/businessDates'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessDatesTable()

  if (e.method === 'GET') {
    const { from, to, status } = getQuery(e)
    let sql = `
      SELECT b.*, a.name as owner_name, a.color as owner_color
      FROM business_dates b
      LEFT JOIN accounts a ON b.created_by = a.id
      WHERE b.partnership_id = $1
    `
    const params: any[] = [account.partnership_id]
    if (from) { params.push(from); sql += ` AND b.starts_at >= $${params.length}` }
    if (to) { params.push(to); sql += ` AND b.starts_at <= $${params.length}` }
    if (status) { params.push(status); sql += ` AND b.status = $${params.length}` }
    sql += ' ORDER BY b.starts_at ASC, b.id ASC'
    return (await query(sql, params)).rows
  }

  if (e.method === 'POST') {
    const b = await readBody(e)
    if (!b?.title || !b?.starts_at) {
      throw createError({ statusCode: 400, message: 'title and starts_at are required' })
    }
    const kind = BUSINESS_KINDS.includes(b.kind) ? b.kind : 'meeting'
    const status = BUSINESS_STATUSES.includes(b.status) ? b.status : 'planned'
    // Une fin antérieure ou égale au début n'est jamais stockée (elle produirait un créneau négatif)
    let endsAt = b.ends_at || null
    if (endsAt && new Date(endsAt).getTime() <= new Date(b.starts_at).getTime()) endsAt = null
    const r = await query(
      `INSERT INTO business_dates
         (partnership_id, created_by, title, contact, kind, location, meeting_url,
          starts_at, ends_at, all_day, status, reminder_min, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        account.partnership_id, account.id, b.title, b.contact || '', kind,
        b.location || '', b.meeting_url || '', b.starts_at, endsAt,
        !!b.all_day, status, Number.isFinite(+b.reminder_min) ? +b.reminder_min : 30, b.notes || '',
      ]
    )
    return r.rows[0]
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
