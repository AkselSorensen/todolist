import { query } from '../utils/db'

export default defineEventHandler(async (event) => {
  // Get events for partnership 1 (Aksel & Amandine)
  const events = await query(
    `SELECT title, description, event_type, start_time, end_time, all_day, location, color
     FROM calendar_events WHERE partnership_id = 1 ORDER BY start_time ASC`
  )

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nous Deux//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Nous Deux',
    'X-WR-CALDESC:Calendrier partagé Aksel & Amandine',
  ]

  for (const e of events.rows) {
    const start = new Date(e.start_time)
    const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 3600000)
    const format = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const uid = `${e.start_time}-${e.title}`.replace(/[^a-z0-9]/gi, '') + '@nousdeux'

    icsLines.push('BEGIN:VEVENT')
    icsLines.push(`UID:${uid}`)
    icsLines.push(`DTSTART:${format(start)}`)
    icsLines.push(`DTEND:${format(end)}`)
    icsLines.push(`SUMMARY:${e.title}`)
    if (e.description) icsLines.push(`DESCRIPTION:${e.description}`)
    if (e.location) icsLines.push(`LOCATION:${e.location}`)
    icsLines.push('END:VEVENT')
  }

  icsLines.push('END:VCALENDAR')

  setHeader(event, 'Content-Type', 'text/calendar; charset=utf-8')
  setHeader(event, 'Content-Disposition', 'inline; filename="nousdeux.ics"')
  return icsLines.join('\r\n')
})
