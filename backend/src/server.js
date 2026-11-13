import { pool } from './database/connection.js';
import { initializeDatabase } from './database/initialize.js';
import { createApp } from './app.js';

try {
  await initializeDatabase();
  const server = createApp().listen(3003, () => console.log('Servidor funcionando en http://localhost:3003'));
  const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('No se pudo preparar el esquema de BarberBook:', error.code || error.name);
  await pool.end();
  process.exitCode = 1;
}
