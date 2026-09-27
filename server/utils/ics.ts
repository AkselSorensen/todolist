// Génération du fichier iCalendar (.ics) du calendrier partagé.
//
// Contraintes RFC 5545 respectées ici (sinon iOS/Android refusent ou décalent
// les événements) :
//  - lignes pliées à 75 octets (continuation précédée d'une espace) ;
//  - journées entières = DTSTART/DTEND;VALUE=DATE, DTEND **exclusif** ;
//    sans ça Apple/Google affichent l'événement à 01:00/02:00 en heure locale ;
//  - alertes = VALARM (TRIGGER en durée négative) ;
//  - texte échappé (\, ; , et retours ligne).

export interface IcsEvent {
  id: number
  title: string
  description?: string | null
  location?: string | null
  event_type?: string | null
  start_time: string
  end_time?: string | null
  all_day?: boolean | null
  alert_before?: number | null
  color?: string | null
  created_at?: string | null
  creator_name?: string | null
}

export interface IcsOptions {
  name?: string
  description?: string
  /** Domaine utilisé pour les UID (identifie les événements d'un même calendrier) */
  uidDomain?: string
}

const PRODID = '-//Nous Deux//Calendrier partage//FR'
const encoder = new TextEncoder()

function pad2(n: number) { return String(n).padStart(2, '0') }

/** Date locale telle qu'écrite en base ("2026-05-01T14:00:00.000Z" -> "2026-05-01") */
function datePart(iso: string) { return (iso || '').split('T')[0] }

/** "2026-05-01" -> "20260501" */
function compactDate(ymd: string) { return ymd.replace(/-/g, '') }

/** Jour suivant (DTEND des événements journée entière est exclusif) */
function nextDay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/** Instant UTC au format iCalendar : 20260501T140000Z */
function fmtUtc(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Alerte "alert_before" (minutes) -> durée iCalendar négative */
function alarmTrigger(minutes: number) {
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`
  return `-PT${minutes}M`
}

export function escapeIcsText(text: string): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** Plie une ligne à 75 octets (UTF-8) comme l'exige la RFC 5545 */
function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 75) {
      parts.push(current)
      current = ' ' // les lignes de continuation commencent par une espace
      bytes = 1
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n')
}

function pushEvent(lines: string[], e: IcsEvent, uidDomain: string) {
  const startIso = e.start_time
  if (!startIso) return
  const allDay = !!e.all_day
  const startDay = datePart(startIso)
  const uid = `nousdeux-${e.id}@${uidDomain}`
  const created = fmtUtc(e.created_at || startIso)

  lines.push('BEGIN:VEVENT')
  lines.push(`UID:${uid}`)
  lines.push(`DTSTAMP:${fmtUtc(new Date())}`)
  lines.push(`CREATED:${created}`)
  lines.push(`LAST-MODIFIED:${created}`)
  lines.push(`SUMMARY:${escapeIcsText(e.title || 'Événement')}`)

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(startDay)}`)
    const endDay = e.end_time ? datePart(e.end_time) : startDay
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(endDay >= startDay ? endDay : startDay))}`)
  } else {
    lines.push(`DTSTART:${fmtUtc(startIso)}`)
    const end = e.end_time ? new Date(e.end_time) : new Date(new Date(startIso).getTime() + 3600000)
    lines.push(`DTEND:${fmtUtc(end)}`)
  }

  const desc: string[] = []
  if (e.description) desc.push(e.description)
  if (e.creator_name) desc.push(`Ajouté par ${e.creator_name}`)
  if (desc.length) lines.push(`DESCRIPTION:${escapeIcsText(desc.join('\n\n'))}`)
  if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`)

  // Les "disponibilités" ne doivent pas bloquer l'agenda du téléphone
  lines.push(e.event_type === 'availability' ? 'TRANSP:TRANSPARENT' : 'TRANSP:OPAQUE')
  lines.push('STATUS:CONFIRMED')
  if (e.color) lines.push(`X-APPLE-CALENDAR-COLOR:${e.color}`)
  if (e.creator_name) lines.push(`X-CREATOR:${escapeIcsText(e.creator_name)}`)

  const alert = Number(e.alert_before || 0)
  if (alert > 0) {
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push(`TRIGGER:${alarmTrigger(alert)}`)
    lines.push(`DESCRIPTION:${escapeIcsText(e.title || 'Rappel')}`)
    lines.push('END:VALARM')
  }

  lines.push('END:VEVENT')
}

export function buildCalendarIcs(events: IcsEvent[], options: IcsOptions = {}): string {
  const uidDomain = options.uidDomain || 'nousdeux.app'
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.name || 'Nous Deux')}`,
    `X-WR-CALDESC:${escapeIcsText(options.description || 'Notre calendrier partagé')}`,
    'X-WR-TIMEZONE:Europe/Paris',
    // Cadence de rafraîchissement conseillée aux clients qui la respectent
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]

  for (const e of events) pushEvent(lines, e, uidDomain)

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
