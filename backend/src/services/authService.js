import { randomBytes, createHash, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from '../database/connection.js';

const scrypt = promisify(derive);
const parameters = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const httpError = (status, message) => Object.assign(new Error(message), { status });
export const hashToken = (value) => createHash('sha256').update(value).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, parameters);
  return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$131072$8$1' ||
      !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const key = await scrypt(password, parts[4], 64, parameters);
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex'));
}

export function createAuthService(database = pool) {
  const failures = new Map();
  const dummy = hashPassword(randomBytes(32).toString('hex'));
  return {
    async login(email, password, ip, previousToken) {
      const attempt = failures.get(ip);
      if (attempt && attempt.until > Date.now() && attempt.count >= 10) {
        throw httpError(429, 'Demasiados intentos de acceso. Espera 15 minutos.');
      }
      const { rows: [professional] } = await database.query(
        'SELECT id,name,email,password_hash,automatic_approval FROM professionals WHERE lower(email)=$1', [email.toLowerCase()]);
      const valid = await verifyPassword(password, professional?.password_hash || await dummy);
      if (!professional || !valid) {
        for (const [key, value] of failures) if (value.until < Date.now()) failures.delete(key);
        failures.set(ip, { count: attempt?.until > Date.now() ? attempt.count + 1 : 1, until: Date.now() + 15 * 60000 });
        throw httpError(401, 'Correo o contraseña incorrectos.');
      }
      failures.delete(ip);
      const token = randomBytes(32).toString('hex');
      const csrfToken = randomBytes(32).toString('hex');
      await database.query('DELETE FROM professional_sessions WHERE expires_at<=now()');
      if (previousToken) await database.query('DELETE FROM professional_sessions WHERE token_hash=$1', [hashToken(previousToken)]);
      await database.query("INSERT INTO professional_sessions(token_hash,professional_id,csrf_token,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '8 hours')",
        [hashToken(token), professional.id, csrfToken]);
      return { token, user: { id: professional.id, name: professional.name, email: professional.email, automatic_approval: professional.automatic_approval, csrfToken } };
    },
    async session(token) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      const { rows: [session] } = await database.query(`SELECT p.id,p.name,p.email,p.automatic_approval,s.csrf_token AS "csrfToken"
        FROM professional_sessions s JOIN professionals p ON p.id=s.professional_id
        WHERE s.token_hash=$1 AND s.expires_at>now()`, [hashToken(token)]);
      return session ?? null;
    },
    async logout(token) {
      await database.query('DELETE FROM professional_sessions WHERE token_hash=$1', [hashToken(token)]);
    },
  };
}
