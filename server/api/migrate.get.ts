import { query } from '../utils/db'

export default defineEventHandler(async () => {
  const akselId = 4
  const amandineId = 5
  const partnershipId = 1

  // Fix visited_by from text to account IDs
  const r1 = await query("UPDATE visited_countries SET visited_by = $1 WHERE visited_by = 'aksel' AND partnership_id = $2", [String(akselId), partnershipId])
  const r2 = await query("UPDATE visited_countries SET visited_by = $1 WHERE visited_by = 'amandine' AND partnership_id = $2", [String(amandineId), partnershipId])

  // Fix todos created_by/assigned_to from old user IDs (1,2) to account IDs (4,5)
  const r3 = await query('UPDATE todos SET created_by = $1 WHERE created_by = 1 AND partnership_id = $2', [akselId, partnershipId])
  const r4 = await query('UPDATE todos SET created_by = $1 WHERE created_by = 2 AND partnership_id = $2', [amandineId, partnershipId])
  const r5 = await query('UPDATE todos SET assigned_to = $1 WHERE assigned_to = 1 AND partnership_id = $2', [akselId, partnershipId])
  const r6 = await query('UPDATE todos SET assigned_to = $1 WHERE assigned_to = 2 AND partnership_id = $2', [amandineId, partnershipId])

  // Fix calendar_events created_by
  const r7 = await query('UPDATE calendar_events SET created_by = $1 WHERE created_by = 1 AND partnership_id = $2', [akselId, partnershipId])
  const r8 = await query('UPDATE calendar_events SET created_by = $1 WHERE created_by = 2 AND partnership_id = $2', [amandineId, partnershipId])

  // Verify
  const vc = await query("SELECT visited_by, COUNT(*) FROM visited_countries WHERE partnership_id = $1 GROUP BY visited_by", [partnershipId])

  return {
    success: true,
    visited_by_distribution: vc.rows,
    rows_updated: {
      visited_aksel: r1.rowCount,
      visited_amandine: r2.rowCount,
      todos_created_aksel: r3.rowCount,
      todos_created_amandine: r4.rowCount,
      todos_assigned_aksel: r5.rowCount,
      todos_assigned_amandine: r6.rowCount,
      events_aksel: r7.rowCount,
      events_amandine: r8.rowCount,
    }
  }
})
