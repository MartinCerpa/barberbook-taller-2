import { config } from './config/env.js'
import { connectDatabases } from './config/database.js'
import { migrate } from './repositories/migrations.js'
import { createApp } from './app.js'

let databases
try {
  const db = await connectDatabases(config)
  databases = db
  await migrate(db.pool)
  const app = createApp(db,config)
  const server = app.listen(config.port,config.host,() => console.log(`API académica: http://${config.host}:${config.port}/api/docs`))
  const relay = setInterval(() => app.locals.events.flush().catch(() => console.error('Eventos pendientes; se reintentará la entrega a MongoDB.')),3000)
  relay.unref()
  const shutdown = async () => { clearInterval(relay); server.close(); await db.close(); process.exit(0) }
  process.on('SIGINT',shutdown)
  process.on('SIGTERM',shutdown)
} catch (error) {
  await databases?.close()
  console.error('No se pudo iniciar la API. Revisa las bases académicas y .env.',error.code || error.name)
  process.exitCode = 1
}
