import { readFile } from 'node:fs/promises';
import { pool } from './connection.js';

export async function initializeDatabase(database = pool, withSeed = false) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('barberbook_t3_schema'))");
    await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    if (withSeed) await client.query(await readFile(new URL('./seed.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
