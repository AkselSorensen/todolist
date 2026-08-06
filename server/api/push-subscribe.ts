import { query } from '../utils/db'

export default defineEventHandler(async (e) => {
  const config = useRuntimeConfig()

  if (e.method === 'GET') {
    return { publicKey: config.vapidPublicKey }
  }

  if (e.method === 'POST') {
    const { subscription, account_id } = await readBody(e)
    if (!subscription?.endpoint) throw createError({ statusCode: 400 })

    await query(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        partnership_id INT REFERENCES partnerships(id),
        account_id INT REFERENCES accounts(id),
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT,
        auth TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    )

    await query(
      `INSERT INTO push_subscriptions (partnership_id, account_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET account_id=$2, p256dh=$4, auth=$5, partnership_id=$1, updated_at=NOW()`,
      [1, account_id || 4, subscription.endpoint, subscription.keys?.p256dh, subscription.keys?.auth]
    )
    return { success: true }
  }

  if (e.method === 'DELETE') {
    const { endpoint } = await readBody(e)
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
    return { success: true }
  }
})
