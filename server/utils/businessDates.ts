import { query } from './db'

// Auto-create the business_dates table on first use (same pattern as the other
// API-driven tables). Memoized so the DDL only runs once per lambda instance.
let ready: Promise<void> | null = null

async function create() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_dates (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      created_by INT REFERENCES accounts(id),
      title TEXT NOT NULL,
      contact TEXT DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'meeting',
      location TEXT DEFAULT '',
      meeting_url TEXT DEFAULT '',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ,
      all_day BOOLEAN DEFAULT false,
      status TEXT NOT NULL DEFAULT 'planned',
      reminder_min INT DEFAULT 30,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Progressive migrations (safe on existing DBs)
  await query(`ALTER TABLE business_dates ADD COLUMN IF NOT EXISTS meeting_url TEXT DEFAULT ''`)
  await query(`ALTER TABLE business_dates ADD COLUMN IF NOT EXISTS reminder_min INT DEFAULT 30`)
  await query(`ALTER TABLE business_dates ADD COLUMN IF NOT EXISTS contact TEXT DEFAULT ''`)
  await query(`ALTER TABLE business_dates ADD COLUMN IF NOT EXISTS all_day BOOLEAN DEFAULT false`)
}

export function ensureBusinessDatesTable() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e })
  return ready
}

export const BUSINESS_KINDS = ['meeting', 'call', 'client', 'interview', 'deadline', 'other'] as const
export const BUSINESS_STATUSES = ['planned', 'confirmed', 'done', 'cancelled'] as const
