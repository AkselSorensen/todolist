import pg from 'pg'
const { Pool } = pg

let pool: pg.Pool | null = null

export function getDb(): pg.Pool {
  if (pool) return pool
  const url = process.env.DATABASE_URL || useRuntimeConfig().databaseUrl
  if (!url) throw new Error('DATABASE_URL missing')
  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  pool.on('connect', async (client) => {
    await client.query("SET client_encoding TO 'UTF8'")
  })
  return pool
}

export async function query(text: string, params?: any[]) {
  const client = await getDb().connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
