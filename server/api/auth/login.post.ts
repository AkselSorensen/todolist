import { query } from '../../utils/db'
import { comparePassword, generateTokens, setAuthCookies, storeRefreshToken } from '../../utils/auth'

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

  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'email and password are required' })
  }

  const emailLower = email.toLowerCase().trim()

  const result = await query(
    'SELECT id, email, name, color, password_hash, partnership_id, partner_id FROM accounts WHERE email = $1',
    [emailLower]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const account = result.rows[0]

  if (!comparePassword(password, account.password_hash)) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

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

  return {
    account: {
      id: account.id,
      email: account.email,
      name: account.name,
      color: account.color,
      partnership_id: account.partnership_id,
      partner_id: account.partner_id,
    }
  }
})
