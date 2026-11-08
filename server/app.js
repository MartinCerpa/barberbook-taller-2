import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { ZodError } from 'zod'
import { apiRoutes } from './routes/index.js'
import { createControllers } from './controllers/apiController.js'
import { eventService } from './services/eventService.js'
import { openapi } from './openapi.js'

export function createApp(databases, { origin = 'http://localhost:5174' } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin }))
  app.use(express.json({ limit: '32kb' }))
  const events = eventService(databases.pool,databases.events)
  app.locals.events = events
  app.get('/api/openapi.json', (_req,res) => res.json(openapi))
  app.use('/api/docs',swaggerUi.serve,swaggerUi.setup(openapi))
  app.use('/api',apiRoutes(createControllers(databases,events)))
  app.use((_req,res) => res.status(404).json({ error: { message: 'Ruta no encontrada.' } }))
  app.use((error,_req,res,_next) => {
    if (error instanceof ZodError) return res.status(400).json({ error: { message: 'Revisa los datos enviados.',details: error.issues.map(({ path,message }) => ({ path,message })) } })
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'JSON inválido.' } })
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Solicitud demasiado grande.' } })
    if (['23505','23P01','23503'].includes(error.code)) return res.status(409).json({ error: { message: 'Conflicto: registro duplicado, horario solapado o relaciones incompatibles.' } })
    if (['23514','22P02','22007','22008','22003'].includes(error.code)) return res.status(400).json({ error: { message: 'Los datos no cumplen las restricciones de la base.' } })
    const databaseFailure = ['MongoServerSelectionError','MongoNetworkError','MongoTopologyClosedError'].includes(error.name) || ['ECONNREFUSED','ECONNRESET','57P01'].includes(error.code)
    const status = error.status || (databaseFailure ? 503 : 500)
    if (status >= 500) console.error('Error del servicio:', error.code || error.name)
    return res.status(status).json({ error: { message: status >= 500 ? 'Servicio temporalmente no disponible. Inténtalo nuevamente.' : error.message } })
  })
  return app
}
