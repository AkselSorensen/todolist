import { query } from '../utils/db'

export default defineEventHandler(async () => {
  const results: string[] = []
  
  // Check old data
  const vc = await query('SELECT COUNT(*) as c FROM visited_countries WHERE partnership_id IS NULL')
  const td = await query('SELECT COUNT(*) as c FROM todos WHERE partnership_id IS NULL')
  const ce = await query('SELECT COUNT(*) as c FROM calendar_events WHERE partnership_id IS NULL')
  
  results.push(`visited_countries sans partnership: ${vc.rows[0].c}`)
  results.push(`todos sans partnership: ${td.rows[0].c}`)
  results.push(`calendar_events sans partnership: ${ce.rows[0].c}`)
  
  // Aksel=4, Amandine=5, partnership=1
  const akselId = 4
  const amandineId = 5
  const partnershipId = 1
  
  // Migrate visited_countries
  const vcOld = await query("SELECT * FROM visited_countries WHERE partnership_id IS NULL")
  for (const row of vcOld.rows) {
    let newBy = row.visited_by
    if (row.visited_by === 'aksel') newBy = String(akselId)
    else if (row.visited_by === 'amandine') newBy = String(amandineId)
    // 'both' and 'wishlist' stay as-is
    
    await query(
      'UPDATE visited_countries SET visited_by = $1, partnership_id = $2 WHERE id = $3',
      [newBy, partnershipId, row.id]
    )
  }
  
  // Migrate todos
  const tdOld = await query('SELECT * FROM todos WHERE partnership_id IS NULL')
  for (const row of tdOld.rows) {
    let createdBy = row.created_by
    let assignedTo = row.assigned_to
    if (createdBy === 1) createdBy = akselId
    else if (createdBy === 2) createdBy = amandineId
    if (assignedTo === 1) assignedTo = akselId
    else if (assignedTo === 2) assignedTo = amandineId
    
    await query(
      'UPDATE todos SET created_by = $1, assigned_to = $2, partnership_id = $3 WHERE id = $4',
      [createdBy, assignedTo, partnershipId, row.id]
    )
  }
  
  // Migrate calendar_events
  const ceOld = await query('SELECT * FROM calendar_events WHERE partnership_id IS NULL')
  for (const row of ceOld.rows) {
    let createdBy = row.created_by
    if (createdBy === 1) createdBy = akselId
    else if (createdBy === 2) createdBy = amandineId
    
    await query(
      'UPDATE calendar_events SET created_by = $1, partnership_id = $2 WHERE id = $3',
      [createdBy, partnershipId, row.id]
    )
  }
  
  // Migrate todo_categories
  await query('UPDATE todo_categories SET partnership_id = $1 WHERE partnership_id IS NULL', [partnershipId])
  
  // Set Aksel's color to blue and Amandine's to rose (matching old colors)
  await query("UPDATE accounts SET color = '#4da6ff' WHERE id = $1", [akselId])
  await query("UPDATE accounts SET color = '#ff6b8a' WHERE id = $1", [amandineId])
  
  const after = {
    vc: (await query('SELECT COUNT(*) as c FROM visited_countries WHERE partnership_id = $1', [partnershipId])).rows[0].c,
    td: (await query('SELECT COUNT(*) as c FROM todos WHERE partnership_id = $1', [partnershipId])).rows[0].c,
    ce: (await query('SELECT COUNT(*) as c FROM calendar_events WHERE partnership_id = $1', [partnershipId])).rows[0].c,
  }
  
  return { success: true, before: results, after }
})
