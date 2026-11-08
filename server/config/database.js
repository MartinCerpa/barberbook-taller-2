import pg from 'pg'
import { MongoClient } from 'mongodb'
import { assertAcademicDatabases } from './env.js'

export async function connectDatabases(config) {
  assertAcademicDatabases(config.databaseUrl, config.mongoDatabase)
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 5000 })
  const mongo = new MongoClient(config.mongoUrl, { serverSelectionTimeoutMS: 3000 })
  try {
    await pool.query('SELECT 1')
    await mongo.connect()
    const events = mongo.db(config.mongoDatabase).collection('events')
    await events.createIndex({ entityId: 1, occurredAt: -1 })
    await events.createIndex({ occurredAt: -1 })
    return { pool, mongo, events, close: async () => { await pool.end(); await mongo.close() } }
  } catch (error) {
    await pool.end()
    await mongo.close()
    throw error
  }
}
