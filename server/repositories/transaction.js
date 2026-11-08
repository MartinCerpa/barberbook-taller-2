export async function transaction(pool, work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

// Todas las operaciones que ocupan una agenda usan el mismo bloqueo transaccional.
export const lockProfessional = (client, id) =>
  client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [id])
