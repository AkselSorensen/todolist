import { query } from '../../utils/db'
import { comparePassword, generateTokens, setAuthCookies, storeRefreshToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
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
