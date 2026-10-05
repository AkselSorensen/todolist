import { query } from './db'

// Relevé mensuel du patrimoine : une photo par mois et par propriétaire.
// Le mois est calculé par Postgres (date_trunc) pour que la même valeur serve au stockage
// et à la lecture — pas de décalage JS/SQL au changement de mois.
let ready: Promise<void> | null = null

async function create() {
  await query(`
    CREATE TABLE IF NOT EXISTS business_net_worth_snapshots (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      owner_id INT REFERENCES accounts(id),
      month DATE NOT NULL,
      total NUMERIC(14,2) NOT NULL DEFAULT 0,
      assets_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // owner_id NULL (bien commun) : en SQL deux NULL sont distincts, donc une contrainte
  // UNIQUE classique laisserait passer les doublons -> index unique sur COALESCE.
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS business_net_worth_snapshots_uniq
      ON business_net_worth_snapshots (partnership_id, COALESCE(owner_id, 0), month)
  `)
  await query(`CREATE INDEX IF NOT EXISTS business_net_worth_snapshots_month_idx ON business_net_worth_snapshots (partnership_id, month)`)
}

export function ensureBusinessSnapshotsTable() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e })
  return ready
}

// Écrit (ou réécrit) la photo du mois courant : elle reste vivante jusqu'à la fin du mois,
// les mois passés ne bougent plus. Idempotent : DELETE puis INSERT des lignes du mois.
export async function captureCurrentMonth(partnershipId: number) {
  // les personnes du couple + le bien commun (NULL)
  const owners = (await query('SELECT id FROM accounts WHERE partnership_id = $1 ORDER BY id', [partnershipId]))
    .rows.map((r: any) => r.id)

  const sums = (await query(`
    SELECT a.owner_id,
           COALESCE(SUM(a.value), 0)::float8 AS total,
           COUNT(*)::int AS n
    FROM business_assets a
    WHERE a.partnership_id = $1
    GROUP BY a.owner_id`, [partnershipId])).rows

  const byOwner = new Map<string, { total: number; n: number }>()
  for (const s of sums) byOwner.set(String(s.owner_id), { total: Number(s.total) || 0, n: Number(s.n) || 0 })

  await query(`DELETE FROM business_net_worth_snapshots WHERE partnership_id = $1 AND month = date_trunc('month', NOW())::date`, [partnershipId])

  // une ligne par personne ET une ligne pour le commun, même à 0 : la courbe reste continue
  for (const ownerId of [...owners, null]) {
    const v = byOwner.get(String(ownerId)) || { total: 0, n: 0 }
    await query(
      `INSERT INTO business_net_worth_snapshots (partnership_id, owner_id, month, total, assets_count)
       VALUES ($1, $2, date_trunc('month', NOW())::date, $3, $4)`,
      [partnershipId, ownerId, v.total, v.n]
    )
  }
}

// Historique sur N mois : lignes brutes (le client pivote), du plus ancien au plus récent.
export async function fetchSnapshots(partnershipId: number, months: number) {
  return (await query(`
    SELECT s.id, s.month, s.owner_id, s.total::float8 AS total, s.assets_count,
           o.name as owner_name, o.color as owner_color
    FROM business_net_worth_snapshots s
    LEFT JOIN accounts o ON s.owner_id = o.id
    WHERE s.partnership_id = $1
      AND s.month >= (date_trunc('month', NOW()) - ($2 || ' months')::interval)::date
    ORDER BY s.month ASC, s.owner_id NULLS LAST, s.id ASC`, [partnershipId, String(Math.max(1, months) - 1)])).rows
}
