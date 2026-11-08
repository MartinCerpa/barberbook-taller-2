import 'dotenv/config'

export const config = {
  port: Number(process.env.API_PORT || 3003),
  host: process.env.API_HOST || '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL,
  mongoUrl: process.env.MONGODB_URI,
  mongoDatabase: process.env.MONGODB_DATABASE || 'barberbook_hito3',
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5174',
  timeZone: 'America/Santiago',
}

export function assertAcademicDatabases(databaseUrl, mongoDatabase) {
  if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).startsWith('barberbook_hito3')) {
    throw new Error('DATABASE_URL debe apuntar a una base barberbook_hito3 aislada.')
  }
  if (!mongoDatabase.startsWith('barberbook_hito3')) {
    throw new Error('MongoDB debe usar una base barberbook_hito3 aislada.')
  }
}
