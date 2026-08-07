import { query } from '../utils/db'
import { getCurrentAccount } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const account = await getCurrentAccount(event)
  if (!account.partnership_id) throw createError({ statusCode: 400, message: 'No partner yet' })

  const events = await query(
    `SELECT ce.*, a.name as creator_name
     FROM calendar_events ce LEFT JOIN accounts a ON ce.created_by = a.id
     WHERE ce.partnership_id = $1 ORDER BY ce.start_time ASC`,
    [account.partnership_id]
  )

  const now = new Date()
  const fmtDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const fmtStamp = fmtDate(now)

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nous Deux//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Nous Deux',
    `X-WR-CALDESC:Calendrier partage ${account.name} & partenaire`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]

  for (const e of events.rows) {
    const start = new Date(e.start_time)
    const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 3600000)
    const created = e.created_at ? new Date(e.created_at) : start
    const uid = `nousdeux-${e.id}@nousdeux.fr`

    icsLines.push('BEGIN:VEVENT')
    icsLines.push(`UID:${uid}`)
    icsLines.push(`DTSTART:${fmtDate(start)}`)
    icsLines.push(`DTEND:${fmtDate(end)}`)
    icsLines.push(`DTSTAMP:${fmtStamp}`)
    icsLines.push(`CREATED:${fmtDate(created)}`)
    icsLines.push(`LAST-MODIFIED:${fmtDate(created)}`)
    icsLines.push(`SUMMARY:${escapeIcs(e.title)}`)
    if (e.description) icsLines.push(`DESCRIPTION:${escapeIcs(e.description)}`)
    if (e.location) icsLines.push(`LOCATION:${escapeIcs(e.location)}`)
    if (e.creator_name) icsLines.push(`X-CREATOR:${escapeIcs(e.creator_name)}`)
    if (e.color) icsLines.push(`X-COLOR:${e.color}`)
    icsLines.push('END:VEVENT')
  }

  icsLines.push('END:VCALENDAR')

  setHeader(event, 'Content-Type', 'text/calendar; charset=utf-8')
  setHeader(event, 'Content-Disposition', 'inline; filename="nousdeux.ics"')
  setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  return icsLines.join('\r\n')
})

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}
