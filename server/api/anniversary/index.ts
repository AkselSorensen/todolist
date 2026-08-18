import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Jours écoulés entre une date ISO (YYYY-MM-DD) et aujourd'hui (local, sans décalage UTC)
function dayDiff(from: string | null, today: Date): number | null {
  if (!from) return null
  const [y, m, d] = from.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((now.getTime() - start.getTime()) / 86400000)
}

// Prochain anniversaire (même mois/jour), gère le 29 février
function nextAnniversary(from: string | null, today: Date) {
  if (!from) return null
  const [y, m, d] = from.split('-').map(Number)
  let nextY = today.getFullYear()
  let candidate = new Date(nextY, m - 1, d)
  if (candidate <= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    nextY++
    candidate = new Date(nextY, m - 1, d)
  }
  // 29 février sur une année non bissextile → 28 février
  if (candidate.getMonth() !== m - 1) candidate = new Date(nextY, m - 1, 28)
  const days = Math.round(
    (candidate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000
  )
  return { date: toISO(candidate), days, years: nextY - y }
}

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  const method = e.method

  if (method === 'GET') {
    const r = await query('SELECT started_at, first_date_at FROM partnerships WHERE id = $1', [account.partnership_id])
    const row = r.rows[0] || {}
    const today = new Date()
    const daysTogether = dayDiff(row.started_at, today)
    const daysSinceFirstDate = dayDiff(row.first_date_at, today)
    return {
      started_at: row.started_at || null,
      first_date_at: row.first_date_at || null,
      days_together: daysTogether !== null ? Math.max(0, daysTogether) : null,
      days_since_first_date: daysSinceFirstDate !== null ? Math.max(0, daysSinceFirstDate) : null,
      next_anniversary: nextAnniversary(row.started_at, today),
    }
  }

  if (method === 'PATCH') {
    const body = await readBody(e)
    const sets: string[] = []
    const params: any[] = []
    if (body.started_at !== undefined) { params.push(body.started_at || null); sets.push(`started_at = $${params.length}`) }
    if (body.first_date_at !== undefined) { params.push(body.first_date_at || null); sets.push(`first_date_at = $${params.length}`) }
    if (!sets.length) throw createError({ statusCode: 400, message: 'Nothing to update' })
    params.push(account.partnership_id)
    const r = await query(
      `UPDATE partnerships SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING started_at, first_date_at`,
      params
    )
    return r.rows[0] || {}
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
