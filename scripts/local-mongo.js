import 'dotenv/config'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// Binario mongod real, WiredTiger persistente. El nombre del paquete no implica un mock.
const dbPath = path.resolve('.runtime/mongo')
await mkdir(dbPath,{ recursive: true })
if (!process.env.MONGO_PASSWORD) throw new Error('Configura MONGO_PASSWORD en .env.')
const server = await MongoMemoryServer.create({
  binary: { version: '8.0.17',downloadDir: path.resolve('.runtime/mongodb-binaries') },
  instance: { port: 27028,ip: '127.0.0.1',dbPath,storageEngine: 'wiredTiger',dbName: 'barberbook_hito3' },
  auth: { enable: true,customRootName: process.env.MONGO_USER || 'academic',customRootPwd: process.env.MONGO_PASSWORD },
})
console.log('MongoDB académico listo en 127.0.0.1:27028; almacenamiento persistente en .runtime/mongo. Ctrl+C detiene MongoDB sin borrar datos.')
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async () => { await server.stop({ doCleanup: false }); process.exit(0) })
