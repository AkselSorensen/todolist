import { query } from './db'

// Ce qu'on possède déjà : actifs détenus par Aksel, Amandine ou en commun.
// Même convention que les autres tables : auto-créée, migrations additives.
let ready: Promise<void> | null = null

async function create() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_assets (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      owner_id INT REFERENCES accounts(id),
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      value NUMERIC(14,2) DEFAULT 0,
      quantity NUMERIC(18,8),
      notes TEXT DEFAULT '',
      created_by INT REFERENCES accounts(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,8)`)
  await query(`CREATE INDEX IF NOT EXISTS business_assets_partnership_idx ON business_assets (partnership_id)`)
}

export function ensureBusinessAssetsTable() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e })
  return ready
}

// value/quantity : NUMERIC sort en string via pg -> cast float8 pour le client
export const ASSET_MONEY = `a.value::float8 AS value, a.quantity::float8 AS quantity`

export const ASSET_CATEGORIES = ['crypto', 'stocks', 'real_estate', 'savings', 'business', 'other'] as const
export const ASSET_FIELDS = ['name', 'owner_id', 'category', 'value', 'quantity', 'notes']
