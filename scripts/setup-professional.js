import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import pg from 'pg'
import { hashPassword } from '../server/services/authService.js'
import { assertAcademicDatabases } from '../server/config/env.js'
assertAcademicDatabases(
  process.env.DATABASE_URL,
  process.env.MONGODB_DATABASE || 'barberbook_hito3',
)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const {
    rows: [professional],
  } = await pool.query(
    "SELECT user_id FROM professionals WHERE id='professional-matias'",
  )
  if (!professional)
    throw new Error('Primero inicia la API y aplica sus migraciones.')
  const academicAdmin = process.argv.includes('--academic-admin'),
    professionalOnly = process.argv.includes('--professional-only')
  if (academicAdmin && professionalOnly)
    throw new Error('Selecciona solo un modo de acceso.')
  if (
    (
      await pool.query(
        'SELECT 1 FROM professional_credentials WHERE user_id=$1',
        [professional.user_id],
      )
    ).rowCount
  ) {
    console.log('Matías ya tiene credenciales. No se modifica su contraseña.')
    process.exitCode = 0
  } else {
    const password =
      process.env.MATIAS_INITIAL_PASSWORD ||
      randomBytes(24).toString('base64url')
    if (password.length < 12 || password.length > 128)
      throw new Error(
        'La contraseña privada debe tener entre 12 y 128 caracteres.',
      )
    await fs.mkdir('.runtime/auth', { recursive: true })
    await fs.writeFile(
      '.runtime/auth/matias-login.txt',
      `Usuario: matiasbarber@gmail.com\nContraseña: ${password}\n`,
      { flag: 'wx', mode: 0o600 },
    )
    await pool.query(
      'INSERT INTO professional_credentials(user_id,email,password_hash) VALUES($1,$2,$3)',
      [
        professional.user_id,
        'matiasbarber@gmail.com',
        await hashPassword(password),
      ],
    )
    console.log(
      'Credenciales configuradas. Consulta el archivo privado .runtime/auth/matias-login.txt; no se imprime la contraseña.',
    )
  }
  if (academicAdmin || professionalOnly) {
    await pool.query(
      'UPDATE professional_credentials SET is_admin=$2 WHERE user_id=$1',
      [professional.user_id, academicAdmin],
    )
    console.log(
      academicAdmin
        ? 'Extensión académica habilitada para esta cuenta; vuelve a iniciar sesión.'
        : 'Cuenta limitada al recorrido profesional; vuelve a iniciar sesión.',
    )
  }
} finally {
  await pool.end()
}
