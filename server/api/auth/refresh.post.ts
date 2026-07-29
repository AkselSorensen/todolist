import { verifyAccessToken, consumeRefreshToken, generateTokens, setAuthCookies, storeRefreshToken } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'refresh_token')
  if (!token) {
    throw createError({ statusCode: 401, message: 'No refresh token' })
  }

  const accountId = await consumeRefreshToken(token)
  if (!accountId) {
    throw createError({ statusCode: 401, message: 'Invalid or expired refresh token' })
  }

  const result = await query(
    'SELECT id, email, name, partnership_id, partner_id FROM accounts WHERE id = $1',
    [accountId]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 404, message: 'Account not found' })
  }

  const account = result.rows[0]
  const payload = {
    id: account.id, email: account.email, name: account.name,
    partnership_id: account.partnership_id, partner_id: account.partner_id,
  }

  const tokens = generateTokens(payload)
  await storeRefreshToken(account.id, tokens.refreshToken)
  setAuthCookies(event, tokens.accessToken, tokens.refreshToken)

  return { success: true }
})
