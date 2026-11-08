import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { createServer } from 'vite'
import { config } from '../server/config/env.js'
import { connectDatabases } from '../server/config/database.js'
import { migrate } from '../server/repositories/migrations.js'
import { createApp } from '../server/app.js'

const name=`barberbook_hito3_e2e_${randomUUID().replaceAll('-','').slice(0,12)}`
const url=new URL(config.databaseUrl)
url.pathname='/postgres'
const admin=new pg.Pool({ connectionString: url.toString() })
await admin.query(`CREATE DATABASE ${name}`)
await admin.end()
url.pathname=`/${name}`
const db=await connectDatabases({ ...config,databaseUrl: url.toString(),mongoDatabase: name })
await migrate(db.pool)
// Jornada amplia únicamente en la base nueva de pruebas, para probar turnos cualquier día.
await db.pool.query('DELETE FROM availability')
await db.pool.query("INSERT INTO availability(professional_id,weekday,start_minute,end_minute) SELECT 'professional-matias',d,0,1439 FROM generate_series(0,6) d")
const app=createApp(db,{ origin: 'http://127.0.0.1:5175' })
const server=app.listen(3004,'127.0.0.1')
const vite=await createServer({ server: { host: '127.0.0.1',port: 5175,strictPort: true,proxy: { '/api': 'http://127.0.0.1:3004' } } })
await vite.listen()
console.log(`E2E listo en http://127.0.0.1:5175; evidencia aislada ${name}.`)
const shutdown=async () => { await vite.close(); server.close(); await db.close(); process.exit(0) }
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,shutdown)
