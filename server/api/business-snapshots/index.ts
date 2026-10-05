import { getCurrentAccount } from '../../utils/auth'
import { ensureBusinessSnapshotsTable, captureCurrentMonth, fetchSnapshots } from '../../utils/businessSnapshots'

// L'historique n'est jamais fourni brut : on photographie d'abord le mois courant,
// ainsi la courbe existe dès la première visite du mois, sans tâche planifiée.
export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })
  await ensureBusinessSnapshotsTable()

  if (e.method === 'GET') {
    const { months } = getQuery(e)
    const n = Number.isFinite(+months) ? Math.min(60, Math.max(1, Math.trunc(+months))) : 12

    await captureCurrentMonth(account.partnership_id)
    const rows = await fetchSnapshots(account.partnership_id, n)

    return { months: n, captured_on: new Date().toISOString().slice(0, 10), rows }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
