import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import request from 'supertest'
import { MongoClient } from 'mongodb'
import { config } from '../config/env.js'
import { connectDatabases } from '../config/database.js'
import { migrate } from '../repositories/migrations.js'
import { createApp } from '../app.js'
import { eventService } from '../services/eventService.js'

const enabled = process.env.npm_lifecycle_event === 'test:integration' || process.env.RUN_DB_TESTS === '1'
test('integración REST con PostgreSQL y MongoDB reales aislados', { skip: !enabled,timeout: 90000 },async (t) => {
  // Solo CREATE de una base nueva con prefijo académico. No borra ni reinicializa bases existentes.
  const suffix = randomUUID().replaceAll('-','').slice(0,12)
  const databaseName = `barberbook_hito3_test_${suffix}`
  const adminUrl = new URL(config.databaseUrl)
  adminUrl.pathname='/postgres'
  const admin = new pg.Pool({ connectionString: adminUrl.toString() })
  await admin.query(`CREATE DATABASE ${databaseName}`)
  await admin.end()
  const databaseUrl = new URL(config.databaseUrl)
  databaseUrl.pathname=`/${databaseName}`
  const db = await connectDatabases({ ...config,databaseUrl: databaseUrl.toString(),mongoDatabase: databaseName })
  t.after(() => db.close())
  await migrate(db.pool)
  await migrate(db.pool)
  const app=createApp(db),http=request(app)
  const { rows: [clock] } = await db.pool.query("SELECT to_char((now() AT TIME ZONE 'America/Santiago')::date+1,'YYYY-MM-DD') AS tomorrow,EXTRACT(DOW FROM now() AT TIME ZONE 'America/Santiago')::int AS weekday")
  // Asegura jornadas de prueba independientes del día de ejecución.
  await db.pool.query('DELETE FROM availability')
  await db.pool.query("INSERT INTO availability(professional_id,weekday,start_minute,end_minute) SELECT 'professional-matias',d,0,1439 FROM generate_series(0,6) d")
  const input = { id: randomUUID(),professionalId: 'professional-matias',serviceId: 'haircut',dateId: clock.tomorrow,time: '10:00',customer: { name: 'Cliente Prueba',phone: '+56900000001' } }
  let booking
  await t.test('salud, migraciones idempotentes y CRUD relacional',async () => {
    await http.get('/api/health').expect(200)
    const branches=await http.get('/api/branches').expect(200)
    assert.equal(branches.body.data.length,1)
    const created=await http.post('/api/branches').send({ name: 'Sucursal Ficticia',address: 'Sin dirección real' }).expect(201)
    await http.patch(`/api/branches/${created.body.data.id}`).send({ name: 'Sucursal Editada' }).expect(200)
    const deactivated=await http.delete(`/api/branches/${created.body.data.id}`).expect(200)
    assert.equal(deactivated.body.data.active,false)
    const invalidModule=await http.post('/api/modules').send({ branchId: created.body.data.id,professionalId: 'professional-matias',name: 'Incompatible' }).expect(409)
    assert.ok(invalidModule.body.error)
  })
  await t.test('crear, recuperar e idempotencia; no duplica eventos',async () => {
    const result=await http.post('/api/bookings').send(input).expect(201)
    booking=result.body.data
    assert.equal(booking.status,'pending')
    assert.equal(booking.price,12000)
    await http.post('/api/bookings').send(input).expect(200)
    await http.post('/api/bookings').send({ ...input,time: '11:00' }).expect(409)
    const stored=await http.get(`/api/bookings/${booking.id}`).expect(200)
    assert.equal(stored.body.data.dateId,input.dateId)
    assert.equal(Number((await db.pool.query('SELECT COUNT(*) FROM bookings WHERE id=$1',[booking.id])).rows[0].count),1)
    assert.equal(Number((await db.pool.query('SELECT COUNT(*) FROM event_outbox WHERE entity_id=$1',[booking.id])).rows[0].count),1)
    const alias={ ...input,id: randomUUID(),time: '13:30',customer: { ...input.customer,name: 'Alias de Prueba' } }
    assert.equal((await http.post('/api/bookings').send(alias).expect(201)).body.data.customerName,'Alias de Prueba')
    await http.post('/api/bookings').send(alias).expect(200)
    assert.equal((await http.get(`/api/bookings/${booking.id}`).expect(200)).body.data.customerName,'Cliente Prueba')
  })
  await t.test('solapamientos de intervalos y concurrencia se rechazan; adyacentes funcionan',async () => {
    await http.post('/api/bookings').send({ ...input,id: randomUUID(),time: '10:15' }).expect(409)
    await http.post('/api/bookings').send({ ...input,id: randomUUID(),time: '10:45' }).expect(201)
    const result=await Promise.all([1,2].map(() => http.post('/api/bookings').send({ ...input,id: randomUUID(),time: '15:00' })))
    assert.deepEqual(result.map((r) => r.status).sort(),[201,409])
    const duration=await http.post('/api/bookings').send({ ...input,id: randomUUID(),time: '23:30' }).expect(422)
    assert.ok(duration.body.error.message)
    await assert.rejects(db.pool.query(`INSERT INTO bookings(id,customer_id,branch_id,professional_id,service_id,duration,price,starts_at,ends_at,customer_name_snapshot)
      SELECT $1,customer_id,branch_id,professional_id,service_id,duration,price,starts_at,ends_at,customer_name_snapshot FROM bookings WHERE id=$2`,[randomUUID(),booking.id]),{ code: '23P01' })
  })
  await t.test('disponibilidad y bloqueos se reflejan en SQL y API',async () => {
    const response=await http.get(`/api/availability?professionalId=professional-matias&serviceId=haircut&startDate=${clock.tomorrow}&days=1`).expect(200)
    assert.equal(response.body.data[0].slots.find((s) => s.time==='10:00').isBookable,false)
    const block=await http.post('/api/availability/blocks').send({ professionalId: 'professional-matias',dateId: clock.tomorrow,time: '18:00',duration: 60 }).expect(201)
    await http.post('/api/bookings').send({ ...input,id: randomUUID(),time: '18:15' }).expect(409)
    await http.delete(`/api/availability/blocks/${block.body.data.id}`).expect(200)
    await http.put('/api/availability').send({ professionalId: 'professional-matias',weekday: (clock.weekday+1)%7,intervals: [] }).expect(409)
  })
  await t.test('confirmación, edición y estados terminales válidos',async () => {
    await http.patch(`/api/bookings/${booking.id}/status`).send({ status: 'confirmed' }).expect(200)
    await http.patch(`/api/bookings/${booking.id}/status`).send({ status: 'completed' }).expect(409)
    await http.patch(`/api/bookings/${booking.id}/status`).send({ status: 'no_show' }).expect(409)
    await http.patch(`/api/bookings/${booking.id}`).send({ time: '11:30',duration: 30 }).expect(200)
    await http.patch(`/api/bookings/${booking.id}/status`).send({ status: 'cancelled' }).expect(200)
    await http.patch(`/api/bookings/${booking.id}/status`).send({ status: 'confirmed' }).expect(409)
    await http.patch(`/api/bookings/${booking.id}`).send({ time: '12:30' }).expect(409)
    const other=await http.post('/api/bookings').send({ ...input,id: randomUUID(),time: '12:00' }).expect(201)
    await http.patch(`/api/bookings/${other.body.data.id}/status`).send({ status: 'rejected' }).expect(200)
  })
  await t.test('turnos FIFO, asignación, llamado concurrente y finalización',async () => {
    const turn={ id: randomUUID(),branchId: 'branch-demo',serviceId: 'beard',customer: input.customer }
    const first=(await http.post('/api/tickets').send(turn).expect(201)).body.data
    await http.post('/api/tickets').send(turn).expect(200)
    const second=(await http.post('/api/tickets').send({ ...turn,id: randomUUID() }).expect(201)).body.data
    await http.patch(`/api/tickets/${first.id}/status`).send({ status: 'completed' }).expect(409)
    const calls=await Promise.all([1,2].map(() => http.post('/api/tickets/next').send({ moduleId: 'module-demo' })))
    assert.deepEqual(calls.map((r) => r.status).sort(),[200,409])
    assert.equal(calls.find((r) => r.status===200).body.data.id,first.id)
    await http.patch(`/api/tickets/${first.id}/status`).send({ status: 'completed' }).expect(200)
    const next=(await http.post('/api/tickets/next').send({ moduleId: 'module-demo' }).expect(200)).body.data
    assert.equal(next.id,second.id)
    assert.equal(next.professionalId,'professional-matias')
    await http.patch(`/api/tickets/${second.id}/status`).send({ status: 'completed' }).expect(200)
    await http.post('/api/tickets/next').send({ moduleId: 'module-demo' }).expect(404)
  })
  await t.test('eventos persistidos en MongoDB y reintentos idempotentes del outbox',async () => {
    const unavailable=eventService(db.pool,{ updateOne: async () => { throw new Error('Mongo indisponible simulado') } })
    await assert.rejects(unavailable.flush(),/Mongo indisponible/)
    const pending=Number((await db.pool.query('SELECT COUNT(*) FROM event_outbox WHERE delivered_at IS NULL')).rows[0].count)
    assert.ok(pending>0)
    const result=await http.get(`/api/events?entityId=${booking.id}`).expect(200)
    assert.ok(result.body.data.some((event) => event.action==='booking.created'))
    assert.ok(result.body.data.some((event) => event.action==='booking.confirmed'))
    const count=await db.events.countDocuments()
    await app.locals.events.flush()
    assert.equal(await db.events.countDocuments(),count)
    assert.equal(Number((await db.pool.query('SELECT COUNT(*) FROM event_outbox WHERE delivered_at IS NULL')).rows[0].count),0)
    const mongo=new MongoClient(config.mongoUrl)
    await mongo.connect()
    assert.ok(await mongo.db(databaseName).collection('events').findOne({ entityId: booking.id,action: 'booking.cancelled' }))
    await mongo.close()
  })
  await t.test('métricas e historial reflejan atención real y conexión SQL nueva',async () => {
    const metrics=(await http.get('/api/metrics').expect(200)).body.data
    assert.equal(metrics.queue.completed,2)
    assert.ok(metrics.queue.averageWaitMinutes>=0)
    assert.equal(metrics.bookings.revenue,0)
    const history=(await http.get('/api/history').expect(200)).body.data
    assert.ok(history.some((item) => item.id===booking.id && item.status==='cancelled'))
    const other=new pg.Pool({ connectionString: databaseUrl.toString() })
    assert.equal((await other.query('SELECT status FROM bookings WHERE id=$1',[booking.id])).rows[0].status,'cancelled')
    await other.end()
  })
  console.log(`Evidencia conservada en base aislada ${databaseName} (SQL y MongoDB).`)
})
