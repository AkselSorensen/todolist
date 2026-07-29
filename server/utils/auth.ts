import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query } from './db'

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const REFRESH_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-me') + '-refresh'
const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface AccountPayload {
  id: number
  email: string
  name: string
  partnership_id: number | null
  partner_id: number | null
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function generateAccessToken(payload: AccountPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY })
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex')
}

export function verifyAccessToken(token: string): AccountPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as AccountPayload
  } catch {
    return null
  }
}

export async function storeRefreshToken(accountId: number, token: string) {
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS)
  await query(
    'INSERT INTO refresh_tokens (account_id, token, expires_at) VALUES ($1, $2, $3)',
    [accountId, token, expiresAt]
  )
}

export async function consumeRefreshToken(token: string): Promise<number | null> {
  const result = await query(
    'DELETE FROM refresh_tokens WHERE token = $1 AND expires_at > NOW() RETURNING account_id',
    [token]
  )
  return result.rows[0]?.account_id || null
}

export function generateTokens(account: AccountPayload): { accessToken: string; refreshToken: string } {
  const accessToken = generateAccessToken(account)
  const refreshToken = generateRefreshToken()
  return { accessToken, refreshToken }
}

export function setAuthCookies(event: any, accessToken: string, refreshToken: string) {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
  setCookie(event, 'auth_token', accessToken, { ...cookieOpts, maxAge: 15 * 60 })
  setCookie(event, 'refresh_token', refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 })
}

export function clearAuthCookies(event: any) {
  deleteCookie(event, 'auth_token')
  deleteCookie(event, 'refresh_token')
}
