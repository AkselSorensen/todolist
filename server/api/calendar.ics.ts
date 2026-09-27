import { query } from '../utils/db'
import { getCurrentAccount } from '../utils/auth'
import { buildCalendarIcs } from '../utils/ics'

// Flux iCalendar du calendrier du couple.
// Utilisé par : le bouton "Sync téléphone" (abonnement webcal / Google Agenda)
// et le lien de téléchargement direct (?download=1).
export default defineEventHandler(async (event) => {
  const account = await getCurrentAccount(event)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  const { download } = getQuery(event)

  const events = await query(
    `SELECT ce.*, a.name as creator_name
     FROM calendar_events ce LEFT JOIN accounts a ON ce.created_by = a.id
     WHERE ce.partnership_id = $1 AND ce.start_time IS NOT NULL
     ORDER BY ce.start_time ASC`,
    [account.partnership_id]
  )

  const ics = buildCalendarIcs(events.rows, {
    name: 'Nous Deux',
    description: `Calendrier partagé de ${account.name}${account.partner?.name ? ' & ' + account.partner.name : ''}`,
  })

  setHeader(event, 'Content-Type', 'text/calendar; charset=utf-8')
  setHeader(
    event,
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="nous-deux.ics"`
  )
  // Les apps de calendrier rechargent toutes les heures : pas de cache intermédiaire
  setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
  setHeader(event, 'Access-Control-Allow-Origin', '*')

  return ics
})
