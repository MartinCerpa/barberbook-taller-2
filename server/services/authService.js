import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from 'node:crypto'
import { promisify } from 'node:util'
import { HttpError } from './errors.js'
const scrypt = promisify(derive)
export const tokenHash = (token) =>
  createHash('sha256').update(token).digest('hex')
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${salt}$${hash.toString('hex')}`
}
export async function verifyPassword(password, value) {
  const [type, salt, hex] = String(value).split('$')
  if (type !== 'scrypt' || !salt || !hex) return false
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  const expected = Buffer.from(hex, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/api',
}
export function authService(pool) {
  const failures = new Map()
  const dummy = hashPassword(randomBytes(24).toString('hex'))
  const optionalSession = async (req, _res, next) => {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('barberbook_session='))
      ?.slice('barberbook_session='.length)
    if (cookie && /^[a-f0-9]{64}$/.test(cookie)) {
      const {
        rows: [user],
      } = await pool.query(
        `SELECT p.id AS "professionalId",p.branch_id AS "branchId",p.name,c.email,c.is_admin AS "isAdmin",s.csrf_token AS "csrfToken",s.token_hash AS "tokenHash"
        FROM professional_sessions s JOIN professional_credentials c ON c.user_id=s.user_id JOIN professionals p ON p.user_id=c.user_id
        WHERE s.token_hash=$1 AND s.expires_at>now() AND p.active`,
        [tokenHash(cookie)],
      )
      req.user = user
    }
    next()
  }
  const requireSession = (req, _res, next) => {
    if (!req.user)
      throw new HttpError(
        401,
        'Inicia sesión para acceder al panel profesional.',
      )
    next()
  }
  const protectWrite = (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.user &&
      req.headers['x-csrf-token'] !== req.user.csrfToken
    )
      throw new HttpError(
        403,
        'La sesión requiere un token de seguridad válido.',
      )
    next()
  }
  return {
    optionalSession,
    requireSession,
    protectWrite,
    async login(req, res, input) {
      const key = req.ip,
        entry = failures.get(key)
      if (entry && entry.until > Date.now() && entry.count >= 10)
        throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.')
      const {
        rows: [account],
      } = await pool.query(
        'SELECT * FROM professional_credentials WHERE email=$1',
        [input.email.toLowerCase()],
      )
      const valid = await verifyPassword(
        input.password,
        account?.password_hash || (await dummy),
      )
      if (!account || !valid) {
        if (failures.size > 1000)
          for (const [k, v] of failures)
            if (v.until < Date.now()) failures.delete(k)
        failures.set(key, {
          count: entry?.until > Date.now() ? entry.count + 1 : 1,
          until: Date.now() + 15 * 60000,
        })
        throw new HttpError(401, 'Correo o contraseña incorrectos.')
      }
      const {
        rows: [professional],
      } = await pool.query(
        'SELECT id,name FROM professionals WHERE user_id=$1 AND active',
        [account.user_id],
      )
      if (!professional)
        throw new HttpError(401, 'Correo o contraseña incorrectos.')
      failures.delete(key)
      const token = randomBytes(32).toString('hex'),
        csrfToken = randomBytes(32).toString('hex')
      await pool.query(
        "INSERT INTO professional_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
        [tokenHash(token), account.user_id, csrfToken],
      )
      res.cookie('barberbook_session', token, {
        ...cookieOptions,
        maxAge: 8 * 60 * 60 * 1000,
      })
      return {
        professionalId: professional.id,
        name: professional.name,
        email: account.email,
        isAdmin: account.is_admin,
        csrfToken,
      }
    },
    async logout(req, res) {
      await pool.query(
        'DELETE FROM professional_sessions WHERE token_hash=$1',
        [req.user.tokenHash],
      )
      res.clearCookie('barberbook_session', cookieOptions)
      return { loggedOut: true }
    },
  }
}
