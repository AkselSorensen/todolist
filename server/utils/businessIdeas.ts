import { query } from './db'

// Idées business : quoi faire, combien ça peut rapporter.
// Même convention que businessDates : table auto-créée, migrations additives.
let ready: Promise<void> | null = null

async function create() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_ideas (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      created_by INT REFERENCES accounts(id),
      title TEXT NOT NULL,
      pitch TEXT DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'idea',
      effort TEXT NOT NULL DEFAULT 'medium',
      invested NUMERIC(12,2) DEFAULT 0,
      monthly_target NUMERIC(12,2) DEFAULT 0,
      earned NUMERIC(12,2) DEFAULT 0,
      next_step TEXT DEFAULT '',
      link TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS business_idea_tasks (
      id SERIAL PRIMARY KEY,
      idea_id INT REFERENCES business_ideas(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      done BOOLEAN DEFAULT false,
      position INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS business_idea_tasks_idea_idx ON business_idea_tasks (idea_id)`)
  // Migrations additives (safe sur base existante)
  await query(`ALTER TABLE business_ideas ADD COLUMN IF NOT EXISTS link TEXT DEFAULT ''`)
  await query(`ALTER TABLE business_ideas ADD COLUMN IF NOT EXISTS effort TEXT NOT NULL DEFAULT 'medium'`)
  // Domaine : une idée de boîte (company) ou un placement (investment)
  await query(`ALTER TABLE business_ideas ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'company'`)
}

export function ensureBusinessIdeasTable() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e })
  return ready
}

// Colonnes monétaires : NUMERIC sort en string via pg -> on caste en float8 pour le client.
export const IDEA_MONEY = `invested::float8 AS invested, monthly_target::float8 AS monthly_target, earned::float8 AS earned`

export const IDEA_STAGES = ['idea', 'studying', 'building', 'launched', 'dropped'] as const
export const IDEA_EFFORTS = ['low', 'medium', 'high'] as const
export const IDEA_DOMAINS = ['company', 'investment'] as const

export const IDEA_FIELDS = ['title', 'pitch', 'stage', 'effort', 'invested', 'monthly_target', 'earned', 'next_step', 'link', 'domain']
