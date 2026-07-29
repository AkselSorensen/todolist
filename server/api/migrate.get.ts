import { query } from '../utils/db'

export default defineEventHandler(async () => {
  const akselId = 4
  const amandineId = 5
  const partnershipId = 1

  // Drop old FKs referencing 'users', replace with 'accounts'
  await query('ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_created_by_fkey')
  await query('ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_assigned_to_fkey')
  await query('ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey')

  // Recreate FKs pointing to accounts
  await query('ALTER TABLE todos ADD CONSTRAINT todos_created_by_fkey FOREIGN KEY (created_by) REFERENCES accounts(id)')
  await query('ALTER TABLE todos ADD CONSTRAINT todos_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES accounts(id)')
  await query('ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES accounts(id)')

  // Fix visited_by from text to account IDs
  await query("UPDATE visited_countries SET visited_by = $1 WHERE visited_by = 'aksel' AND partnership_id = $2", [String(akselId), partnershipId])
  await query("UPDATE visited_countries SET visited_by = $1 WHERE visited_by = 'amandine' AND partnership_id = $2", [String(amandineId), partnershipId])

  // Fix todos created_by/assigned_to from old user IDs (1,2) to account IDs (4,5)
  await query('UPDATE todos SET created_by = $1 WHERE created_by = 1 AND partnership_id = $2', [akselId, partnershipId])
  await query('UPDATE todos SET created_by = $1 WHERE created_by = 2 AND partnership_id = $2', [amandineId, partnershipId])
  await query('UPDATE todos SET assigned_to = $1 WHERE assigned_to = 1 AND partnership_id = $2', [akselId, partnershipId])
  await query('UPDATE todos SET assigned_to = $1 WHERE assigned_to = 2 AND partnership_id = $2', [amandineId, partnershipId])

  // Fix calendar_events created_by
  await query('UPDATE calendar_events SET created_by = $1 WHERE created_by = 1 AND partnership_id = $2', [akselId, partnershipId])
  await query('UPDATE calendar_events SET created_by = $1 WHERE created_by = 2 AND partnership_id = $2', [amandineId, partnershipId])

  // Set correct colors (Aksel=blue, Amandine=rose)
  await query("UPDATE accounts SET color = '#4da6ff' WHERE id = $1", [akselId])
  await query("UPDATE accounts SET color = '#ff6b8a' WHERE id = $1", [amandineId])

  const vc = await query("SELECT visited_by, COUNT(*) as c FROM visited_countries WHERE partnership_id = $1 GROUP BY visited_by", [partnershipId])

  return { success: true, visited_by_distribution: vc.rows }
})
