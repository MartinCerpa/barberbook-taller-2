import express from 'express';
import { pool } from './database/connection.js';
import catalogRoutes from './routes/catalogRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import authRoutes from './routes/authRoutes.js';
import professionalRoutes from './routes/professionalRoutes.js';
import { createAuthService } from './services/authService.js';

// La misma aplicación se usa en ejecución normal y en las pruebas con una base aislada.
export function createApp(database = pool) {
  const app = express();
  app.disable('x-powered-by');
  app.locals.database = database;
  app.locals.auth = createAuthService(database);
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', catalogRoutes, bookingRoutes, availabilityRoutes, authRoutes, professionalRoutes);
  app.get('/api/health', async (req, res) => {
    try {
      await database.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande.' });
    const status = error.status || 500;
    if (status >= 500) console.error('Error en la API:', error.code || error.name);
    res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : error.message });
  });
  return app;
}
