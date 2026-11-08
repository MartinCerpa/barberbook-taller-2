import { randomUUID } from 'node:crypto'

export async function recordEvent(client, entityType, entityId, action, metadata = {}) {
  await client.query(`INSERT INTO event_outbox(id,entity_type,entity_id,action,metadata) VALUES($1,$2,$3,$4,$5)`,
    [randomUUID(),entityType,entityId,action,JSON.stringify(metadata)])
}

export function eventService(pool, collection) {
  let flushing
  const flush = () => {
    if (flushing) return flushing
    flushing = (async () => {
      const pending = (await pool.query('SELECT * FROM event_outbox WHERE delivered_at IS NULL ORDER BY occurred_at,id LIMIT 500')).rows
      for (const event of pending) {
        await collection.updateOne({ _id: event.id }, { $setOnInsert: {
          entityType: event.entity_type, entityId: event.entity_id, action: event.action,
          occurredAt: event.occurred_at, metadata: event.metadata,
        } }, { upsert: true })
        await pool.query('UPDATE event_outbox SET delivered_at=now() WHERE id=$1', [event.id])
      }
    })().finally(() => { flushing = null })
    return flushing
  }
  return {
    flush,
    async list({ entityId, limit = 100 }) {
      await flush()
      return collection.find(entityId ? { entityId } : {}).sort({ occurredAt: -1, _id: -1 }).limit(limit).toArray()
    },
  }
}
