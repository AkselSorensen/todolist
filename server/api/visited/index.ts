import { query } from '../../utils/db'
import { getCurrentAccount } from '../../utils/auth'

export default defineEventHandler(async (e) => {
  const account = await getCurrentAccount(e)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  if (e.method === 'GET') {
    return (await query(
      'SELECT country_name, visited_by FROM visited_countries WHERE partnership_id = $1 ORDER BY created_at DESC',
      [account.partnership_id]
    )).rows
  }

  if (e.method === 'POST') {
    const { country, visited_by } = await readBody(e)
    if (!country) throw createError({ statusCode: 400, message: 'country required' })

    const exists = await query(
      'SELECT id, visited_by FROM visited_countries WHERE country_name = $1 AND partnership_id = $2',
      [country, account.partnership_id]
    )

    let result: any

    if (exists.rows.length > 0) {
      if (visited_by) {
        await query('UPDATE visited_countries SET visited_by = $1 WHERE country_name = $2 AND partnership_id = $3',
          [visited_by, country, account.partnership_id])
        result = { visited: true, visited_by }
      } else {
        await query('DELETE FROM visited_countries WHERE country_name = $1 AND partnership_id = $2',
          [country, account.partnership_id])
        result = { visited: false }
      }
    } else {
      const by = visited_by || 'both'
      await query('INSERT INTO visited_countries (country_name, visited_by, partnership_id) VALUES ($1,$2,$3)',
        [country, by, account.partnership_id])
      result = { visited: true, visited_by: by }
    }

    // Notify partner
    if (account.partner_id && visited_by) {
      let msg = ''
      if (visited_by === 'wishlist') msg = `💭 ${account.name} a ajouté ${country} à la wishlist`
      else if (visited_by === 'both') msg = `💞 ${account.name} a marqué ${country} comme visité ensemble`
      else if (String(visited_by) === String(account.id)) msg = `🌍 ${account.name} a visité ${country}`
      else msg = `🌍 ${account.name} a mis à jour ${country}`

      if (msg) {
        await query(
          `INSERT INTO notifications (partnership_id, from_id, to_id, type, message, link) VALUES ($1,$2,$3,'visited',$4,'/carte')`,
          [account.partnership_id, account.id, account.partner_id, msg]
        )
      }
    }

    return result
  }
})
