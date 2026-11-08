import { readdir, readFile } from 'node:fs/promises'
import { transaction } from './transaction.js'

export async function migrate(pool) {
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('barberbook_hito3_migrations'))")
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const folder = new URL('../migrations/', import.meta.url)
    for (const name of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])
      if (applied.rowCount) continue
      await client.query(await readFile(new URL(name, folder), 'utf8'))
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name])
    }
  })
}
