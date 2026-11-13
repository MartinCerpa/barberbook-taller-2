import { randomBytes } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pool } from './connection.js';
import { initializeDatabase } from './initialize.js';
import { hashPassword } from '../services/authService.js';

const exec = promisify(execFile);
const folder = new URL('../../../.runtime/auth/', import.meta.url);
const file = new URL('matias-login.txt', folder);
let client;
let handle;
try {
  await initializeDatabase();
  client = await pool.connect();
  await client.query('BEGIN');
  const email = (process.env.MATIAS_EMAIL || 'matiasbarber@gmail.com').trim().toLowerCase();
  const { rows: [professional] } = await client.query(`SELECT id,email,password_hash FROM professionals
    WHERE lower(email)=$1 OR (email IS NULL AND name='Matías')
    ORDER BY (email IS NOT NULL) DESC,id LIMIT 1 FOR UPDATE`, [email]);
  if (!professional) throw new Error('Primero ejecuta npm run db:setup.');
  if (professional.email || professional.password_hash) {
    console.log('Matías ya tiene credenciales. No se modifica su contraseña.');
  } else {
    const password = process.env.MATIAS_INITIAL_PASSWORD || randomBytes(24).toString('base64url');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
      throw new Error('Revisa el correo privado y usa una contraseña de 12 a 128 caracteres.');
    }
    const hash = await hashPassword(password);
    await mkdir(folder, { recursive: true });
    handle = await open(file, 'wx', 0o600); // No sobrescribir una entrega privada anterior.
    if (process.platform === 'win32') {
      const { stdout } = await exec('whoami', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true });
      const sid = stdout.match(/S-1-\d+(?:-\d+)+/)?.[0];
      if (!sid) throw new Error('No se pudo establecer el acceso privado al archivo.');
      await exec('icacls', [fileURLToPath(file), '/inheritance:r', '/grant:r', `*${sid}:(F)`, '*S-1-5-18:(F)'], { windowsHide: true });
    }
    await handle.writeFile(`Usuario: ${email}\nContraseña: ${password}\n`, 'utf8');
    await client.query('UPDATE professionals SET email=$2,password_hash=$3 WHERE id=$1', [professional.id, email, hash]);
    console.log('Credenciales configuradas. Consúltalas en .runtime/auth/matias-login.txt (privado e ignorado por Git).');
  }
  await client.query('COMMIT');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error('No se crearon credenciales:', error.code || error.message);
  process.exitCode = 1;
} finally {
  await handle?.close();
  client?.release();
  await pool.end();
}
