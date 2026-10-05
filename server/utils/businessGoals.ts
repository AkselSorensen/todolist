import { query } from './db'

// Objectifs par an (patrimoine, épargne, revenus...) portés par Aksel, Amandine ou les deux.
let ready: Promise<void> | null = null

async function create() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_goals (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      owner_id INT REFERENCES accounts(id),
      title TEXT NOT NULL,
      metric TEXT NOT NULL DEFAULT 'custom',
      target_amount NUMERIC(14,2) DEFAULT 0,
      current_amount NUMERIC(14,2) DEFAULT 0,
      year INT NOT NULL,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT DEFAULT '',
      created_by INT REFERENCES accounts(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS business_goals_year_idx ON business_goals (partnership_id, year)`)
}

export function ensureBusinessGoalsTable() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e })
  return ready
}

// NUMERIC -> string via pg : on caste en float8 pour le client.
// GOAL_MONEY est prefixe par l'alias `g` : il ne vaut QUE dans un SELECT ... FROM business_goals g.
// Dans un INSERT ... RETURNING l'alias n'existe pas -> erreur 500 « missing FROM-clause entry for table "g" ».
// D'ou GOAL_MONEY_PLAIN, sans prefixe, pour les clauses RETURNING.
export const GOAL_MONEY = `g.target_amount::float8 AS target_amount, g.current_amount::float8 AS current_amount`
export const GOAL_MONEY_PLAIN = `target_amount::float8 AS target_amount, current_amount::float8 AS current_amount`

// net_worth = progression calculée depuis le patrimoine réel de la personne
export const GOAL_METRICS = ['net_worth', 'savings', 'income', 'custom'] as const
export const GOAL_STATUSES = ['active', 'reached', 'dropped'] as const
export const GOAL_FIELDS = ['title', 'owner_id', 'metric', 'target_amount', 'current_amount', 'year', 'due_date', 'status', 'notes']
