import { getCookie } from 'h3'
import { verifyAccessToken } from '../utils/auth'

const PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/setup',
  '/api/countries',
]

export default defineEventHandler(async (event) => {
  const path = event.path

  // Only protect API routes — page routes are handled client-side
  if (!path.startsWith('/api/')) return

  // Allow public API paths without auth
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return

  // Allow GET on countries for the map
  if (path === '/api/countries' && event.method === 'GET') return

  // Allow GET on users (legacy, non-sensitive)
  if (path === '/api/users' && event.method === 'GET') return

  const token = getCookie(event, 'auth_token')
  if (!token) {
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Invalid or expired token' })
  }

  event.context.account = payload
})
