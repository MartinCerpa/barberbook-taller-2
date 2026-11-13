import { initializeDatabase } from './initialize.js';
import { pool } from './connection.js';

try {
  await initializeDatabase(pool, true);
  console.log('Esquema y jornada inicial preparados sin reemplazar datos existentes.');
} finally { await pool.end(); }
