import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query } from './db'

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

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
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' })
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex')
}

export function verifyAccessToken(token: string): AccountPayload | null {
  try { return jwt.verify(token, ACCESS_SECRET) as AccountPayload } catch { return null }
}

export async function storeRefreshToken(accountId: number, token: string) {
  await query('INSERT INTO refresh_tokens (account_id, token, expires_at) VALUES ($1,$2,$3)',
    [accountId, token, new Date(Date.now() + REFRESH_EXPIRY_MS)])
}

export async function consumeRefreshToken(token: string): Promise<number | null> {
  const r = await query('DELETE FROM refresh_tokens WHERE token = $1 AND expires_at > NOW() RETURNING account_id', [token])
  return r.rows[0]?.account_id || null
}

export function generateTokens(account: AccountPayload) {
  return { accessToken: generateAccessToken(account), refreshToken: generateRefreshToken() }
}

export function setAuthCookies(event: any, accessToken: string, refreshToken: string) {
  const o = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }
  setCookie(event, 'auth_token', accessToken, { ...o, maxAge: 15 * 60 })
  setCookie(event, 'refresh_token', refreshToken, { ...o, maxAge: 7 * 24 * 60 * 60 })
}

export function clearAuthCookies(event: any) {
  deleteCookie(event, 'auth_token', { path: '/' })
  deleteCookie(event, 'refresh_token', { path: '/' })
}

// Fetch fresh account from DB (bypasses stale JWT partnership_id)
export async function getCurrentAccount(event: any) {
  const jwt = event.context.account
  if (!jwt) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const r = await query(
    `SELECT a.id, a.email, a.name, a.color, a.partnership_id, a.partner_id,
            p.name as pn, p.color as pc, p.email as pe
     FROM accounts a LEFT JOIN accounts p ON a.partner_id = p.id WHERE a.id = $1`,
    [jwt.id]
  )
  if (r.rows.length === 0) throw createError({ statusCode: 404, message: 'Account not found' })
  const row = r.rows[0]
  return {
    id: row.id, email: row.email, name: row.name, color: row.color,
    partnership_id: row.partnership_id, partner_id: row.partner_id,
    partner: row.partner_id ? { id: row.partner_id, name: row.pn, color: row.pc, email: row.pe } : null,
  }
}
