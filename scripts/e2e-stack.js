import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { createServer } from 'vite'
import { config } from '../server/config/env.js'
import { connectDatabases } from '../server/config/database.js'
import { migrate } from '../server/repositories/migrations.js'
import { createApp } from '../server/app.js'
import { authenticatedAgent } from '../server/tests/authHelpers.js'
import fs from 'node:fs/promises'

const name = `barberbook_hito3_e2e_${randomUUID().replaceAll('-', '').slice(0, 12)}`
const url = new URL(config.databaseUrl)
url.pathname = '/postgres'
const admin = new pg.Pool({ connectionString: url.toString() })
await admin.query(`CREATE DATABASE ${name}`)
await admin.end()
url.pathname = `/${name}`
const db = await connectDatabases({
  ...config,
  databaseUrl: url.toString(),
  mongoDatabase: name,
})
await migrate(db.pool)
// Jornada amplia únicamente en la base nueva de pruebas, para probar turnos cualquier día.
await db.pool.query('DELETE FROM availability')
await db.pool.query(
  "INSERT INTO availability(professional_id,weekday,start_minute,end_minute) SELECT 'professional-matias',d,0,1439 FROM generate_series(0,6) d",
)
const app = createApp(db, { origin: 'http://127.0.0.1:5175' })
const access = await authenticatedAgent(app, db.pool)
// Atención histórica ficticia para verificar resultado y finanzas sin alterar relojes ni reglas.
await db.pool.query(
  "INSERT INTO users(id,name,phone,role) VALUES('e2e-history-customer','Cliente Historial E2E','+56900000060','customer')",
)
await db.pool.query(
  "INSERT INTO professional_customers(professional_id,customer_id) VALUES('professional-matias','e2e-history-customer')",
)
await db.pool
  .query(`INSERT INTO bookings(id,customer_id,professional_id,branch_id,service_id,duration,price,starts_at,ends_at,status,customer_name_snapshot,confirmed_at)
 VALUES('e2e-history','e2e-history-customer','professional-matias','branch-demo','beard',30,8000,now()-interval '2 hours',now()-interval '90 minutes','confirmed','Cliente Historial E2E',now()-interval '3 hours')`)
const historical = (
  await db.pool.query(
    "SELECT to_char(starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS date,to_char(starts_at AT TIME ZONE 'America/Santiago','HH24:MI') AS time FROM bookings WHERE id='e2e-history'",
  )
).rows[0]
await fs.mkdir('.runtime', { recursive: true })
await fs.writeFile(
  '.runtime/e2e-access.json',
  JSON.stringify({
    email: access.email,
    password: access.password,
    historical,
  }),
  { mode: 0o600 },
)
const server = app.listen(3004, '127.0.0.1')
const vite = await createServer({
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3004' },
  },
})
await vite.listen()
console.log(`E2E listo en http://127.0.0.1:5175; evidencia aislada ${name}.`)
const shutdown = async () => {
  await vite.close()
  server.close()
  await db.close()
  process.exit(0)
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, shutdown)
