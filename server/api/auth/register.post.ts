import { query } from '../../utils/db'
import { hashPassword, generateTokens, setAuthCookies, storeRefreshToken } from '../../utils/auth'

// Lightweight ensure-tables helper
async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ff6b8a',
      partner_id INT REFERENCES accounts(id),
      partnership_id INT REFERENCES partnerships(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS partnerships (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      account_id INT REFERENCES accounts(id) NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `)
}

export default defineEventHandler(async (event) => {
  await ensureTables()

  const { email, password, name } = await readBody(event)

  if (!email || !password || !name) {
    throw createError({ statusCode: 400, message: 'email, password, and name are required' })
  }

  if (password.length < 6) {
    throw createError({ statusCode: 400, message: 'Password must be at least 6 characters' })
  }

  const emailLower = email.toLowerCase().trim()

  const existing = await query('SELECT id FROM accounts WHERE email = $1', [emailLower])
  if (existing.rows.length > 0) {
    throw createError({ statusCode: 409, message: 'An account with this email already exists' })
  }

  const passwordHash = hashPassword(password)

  const result = await query(
    'INSERT INTO accounts (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, color, partnership_id, partner_id',
    [emailLower, passwordHash, name.trim()]
  )

  const account = result.rows[0]
  const payload = {
    id: account.id,
    email: account.email,
    name: account.name,
    partnership_id: account.partnership_id,
    partner_id: account.partner_id,
  }

  const { accessToken, refreshToken } = generateTokens(payload)
  await storeRefreshToken(account.id, refreshToken)
  setAuthCookies(event, accessToken, refreshToken)

  return { account: { id: account.id, email: account.email, name: account.name } }
})
