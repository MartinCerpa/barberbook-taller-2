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
import { authenticatedAgent } from './authHelpers.js'

const enabled =
  process.env.npm_lifecycle_event === 'test:integration' ||
  process.env.RUN_DB_TESTS === '1'
test(
  'integración REST con PostgreSQL y MongoDB reales aislados',
  { skip: !enabled, timeout: 90000 },
  async (t) => {
    // Solo CREATE de una base nueva con prefijo académico. No borra ni reinicializa bases existentes.
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const databaseName = `barberbook_hito3_test_${suffix}`
    const adminUrl = new URL(config.databaseUrl)
    adminUrl.pathname = '/postgres'
    const admin = new pg.Pool({ connectionString: adminUrl.toString() })
    await admin.query(`CREATE DATABASE ${databaseName}`)
    await admin.end()
    const databaseUrl = new URL(config.databaseUrl)
    databaseUrl.pathname = `/${databaseName}`
    const db = await connectDatabases({
      ...config,
      databaseUrl: databaseUrl.toString(),
      mongoDatabase: databaseName,
    })
    t.after(() => db.close())
    await migrate(db.pool)
    await migrate(db.pool)
    const app = createApp(db),
      { agent: http } = await authenticatedAgent(app, db.pool)
    const {
      rows: [clock],
    } = await db.pool.query(
      "SELECT to_char((now() AT TIME ZONE 'America/Santiago')::date+1,'YYYY-MM-DD') AS tomorrow,EXTRACT(DOW FROM now() AT TIME ZONE 'America/Santiago')::int AS weekday",
    )
    // Asegura jornadas de prueba independientes del día de ejecución.
    await db.pool.query('DELETE FROM availability')
    await db.pool.query(
      "INSERT INTO availability(professional_id,weekday,start_minute,end_minute) SELECT 'professional-matias',d,0,1439 FROM generate_series(0,6) d",
    )
    const input = {
      id: randomUUID(),
      professionalId: 'professional-matias',
      serviceId: 'haircut',
      dateId: clock.tomorrow,
      time: '10:00',
      customer: { name: 'Cliente Prueba', phone: '+56900000001' },
    }
    let booking
    await t.test(
      'salud, migraciones idempotentes y CRUD relacional',
      async () => {
        await http.get('/api/health').expect(200)
        const branches = await http.get('/api/branches').expect(200)
        assert.equal(branches.body.data.length, 1)
        const created = await http
          .post('/api/branches')
          .send({ name: 'Sucursal Ficticia', address: 'Sin dirección real' })
          .expect(201)
        await http
          .patch(`/api/branches/${created.body.data.id}`)
          .send({ name: 'Sucursal Editada' })
          .expect(200)
        const deactivated = await http
          .delete(`/api/branches/${created.body.data.id}`)
          .expect(200)
        assert.equal(deactivated.body.data.active, false)
        const invalidModule = await http
          .post('/api/modules')
          .send({
            branchId: created.body.data.id,
            professionalId: 'professional-matias',
            name: 'Incompatible',
          })
          .expect(409)
        assert.ok(invalidModule.body.error)
      },
    )
    await t.test(
      'crear, recuperar e idempotencia; no duplica eventos',
      async () => {
        const result = await http.post('/api/bookings').send(input).expect(201)
        booking = result.body.data
        assert.equal(booking.status, 'pending')
        assert.equal(booking.price, 12000)
        await http.post('/api/bookings').send(input).expect(200)
        await http
          .post('/api/bookings')
          .send({ ...input, time: '11:00' })
          .expect(409)
        const stored = await http.get(`/api/bookings/${booking.id}`).expect(200)
        assert.equal(stored.body.data.dateId, input.dateId)
        assert.equal(
          Number(
            (
              await db.pool.query('SELECT COUNT(*) FROM bookings WHERE id=$1', [
                booking.id,
              ])
            ).rows[0].count,
          ),
          1,
        )
        assert.equal(
          Number(
            (
              await db.pool.query(
                'SELECT COUNT(*) FROM event_outbox WHERE entity_id=$1',
                [booking.id],
              )
            ).rows[0].count,
          ),
          1,
        )
        const alias = {
          ...input,
          id: randomUUID(),
          time: '13:30',
          customer: { ...input.customer, name: 'Alias de Prueba' },
        }
        assert.equal(
          (await http.post('/api/bookings').send(alias).expect(201)).body.data
            .customerName,
          'Alias de Prueba',
        )
        await http.post('/api/bookings').send(alias).expect(200)
        assert.equal(
          (await http.get(`/api/bookings/${booking.id}`).expect(200)).body.data
            .customerName,
          'Cliente Prueba',
        )
      },
    )
    await t.test(
      'solapamientos de intervalos y concurrencia se rechazan; adyacentes funcionan',
      async () => {
        const competitor = (
          await http
            .post('/api/bookings')
            .send({ ...input, id: randomUUID(), time: '10:15' })
            .expect(201)
        ).body.data
        await http
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'confirmed' })
          .expect(200)
        assert.equal(
          (await http.get(`/api/bookings/${competitor.id}`).expect(200)).body
            .data.status,
          'expired',
        )
        await http
          .post('/api/bookings')
          .send({ ...input, id: randomUUID(), time: '10:45' })
          .expect(201)
        const result = await Promise.all(
          [1, 2].map(() =>
            http
              .post('/api/bookings')
              .send({ ...input, id: randomUUID(), time: '15:00' }),
          ),
        )
        assert.deepEqual(result.map((r) => r.status).sort(), [201, 201])
        const confirmations = await Promise.all(
          result.map((r) =>
            http
              .patch(`/api/bookings/${r.body.data.id}/status`)
              .send({ status: 'confirmed' }),
          ),
        )
        assert.deepEqual(confirmations.map((r) => r.status).sort(), [200, 409])
        const duration = await http
          .post('/api/bookings')
          .send({ ...input, id: randomUUID(), time: '23:30' })
          .expect(422)
        assert.ok(duration.body.error.message)
        await assert.rejects(
          db.pool.query(
            `INSERT INTO bookings(id,customer_id,branch_id,professional_id,service_id,duration,price,starts_at,ends_at,customer_name_snapshot,status)
      SELECT $1,customer_id,branch_id,professional_id,service_id,duration,price,starts_at,ends_at,customer_name_snapshot,'confirmed' FROM bookings WHERE id=$2`,
            [randomUUID(), booking.id],
          ),
          { code: '23P01' },
        )
      },
    )
    await t.test(
      'disponibilidad y bloqueos se reflejan en SQL y API',
      async () => {
        const response = await http
          .get(
            `/api/availability?professionalId=professional-matias&serviceId=haircut&startDate=${clock.tomorrow}&days=1`,
          )
          .expect(200)
        assert.equal(
          response.body.data[0].slots.find((s) => s.time === '10:00')
            .isBookable,
          false,
        )
        const block = await http
          .post('/api/availability/blocks')
          .send({
            professionalId: 'professional-matias',
            dateId: clock.tomorrow,
            time: '18:00',
            duration: 60,
          })
          .expect(201)
        await http
          .post('/api/bookings')
          .send({ ...input, id: randomUUID(), time: '18:15' })
          .expect(409)
        await http
          .delete(`/api/availability/blocks/${block.body.data.id}`)
          .expect(200)
        await http
          .put('/api/availability')
          .send({
            professionalId: 'professional-matias',
            weekday: (clock.weekday + 1) % 7,
            intervals: [],
          })
          .expect(409)
      },
    )
    await t.test(
      'confirmación, edición y estados terminales válidos',
      async () => {
        await http
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'confirmed' })
          .expect(200)
        await http
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'completed' })
          .expect(409)
        await http
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'no_show' })
          .expect(409)
        await http
          .patch(`/api/bookings/${booking.id}`)
          .send({ time: '11:30', duration: 30 })
          .expect(200)
        await http
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'cancelled' })
          .expect(200)
        await http
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'confirmed' })
          .expect(409)
        await http
          .patch(`/api/bookings/${booking.id}`)
          .send({ time: '12:30' })
          .expect(409)
        const other = await http
          .post('/api/bookings')
          .send({ ...input, id: randomUUID(), time: '12:00' })
          .expect(201)
        await http
          .patch(`/api/bookings/${other.body.data.id}/status`)
          .send({ status: 'rejected' })
          .expect(200)
      },
    )
    await t.test(
      'turnos FIFO, asignación, llamado concurrente y finalización',
      async () => {
        const turn = {
          id: randomUUID(),
          branchId: 'branch-demo',
          serviceId: 'beard',
          customer: input.customer,
        }
        const first = (await http.post('/api/tickets').send(turn).expect(201))
          .body.data
        await http.post('/api/tickets').send(turn).expect(200)
        const second = (
          await http
            .post('/api/tickets')
            .send({ ...turn, id: randomUUID() })
            .expect(201)
        ).body.data
        await http
          .patch(`/api/tickets/${first.id}/status`)
          .send({ status: 'completed' })
          .expect(409)
        const calls = await Promise.all(
          [1, 2].map(() =>
            http.post('/api/tickets/next').send({ moduleId: 'module-demo' }),
          ),
        )
        assert.deepEqual(calls.map((r) => r.status).sort(), [200, 409])
        assert.equal(calls.find((r) => r.status === 200).body.data.id, first.id)
        await http
          .patch(`/api/tickets/${first.id}/status`)
          .send({ status: 'completed' })
          .expect(200)
        const next = (
          await http
            .post('/api/tickets/next')
            .send({ moduleId: 'module-demo' })
            .expect(200)
        ).body.data
        assert.equal(next.id, second.id)
        assert.equal(next.professionalId, 'professional-matias')
        await http
          .patch(`/api/tickets/${second.id}/status`)
          .send({ status: 'completed' })
          .expect(200)
        await http
          .post('/api/tickets/next')
          .send({ moduleId: 'module-demo' })
          .expect(404)
      },
    )
    await t.test(
      'eventos persistidos en MongoDB y reintentos idempotentes del outbox',
      async () => {
        const unavailable = eventService(db.pool, {
          updateOne: async () => {
            throw new Error('Mongo indisponible simulado')
          },
        })
        await assert.rejects(unavailable.flush(), /Mongo indisponible/)
        const pending = Number(
          (
            await db.pool.query(
              'SELECT COUNT(*) FROM event_outbox WHERE delivered_at IS NULL',
            )
          ).rows[0].count,
        )
        assert.ok(pending > 0)
        const result = await http
          .get(`/api/events?entityId=${booking.id}`)
          .expect(200)
        assert.ok(
          result.body.data.some((event) => event.action === 'booking.created'),
        )
        assert.ok(
          result.body.data.some(
            (event) => event.action === 'booking.confirmed',
          ),
        )
        const count = await db.events.countDocuments()
        await app.locals.events.flush()
        assert.equal(await db.events.countDocuments(), count)
        assert.equal(
          Number(
            (
              await db.pool.query(
                'SELECT COUNT(*) FROM event_outbox WHERE delivered_at IS NULL',
              )
            ).rows[0].count,
          ),
          0,
        )
        const mongo = new MongoClient(config.mongoUrl)
        await mongo.connect()
        assert.ok(
          await mongo
            .db(databaseName)
            .collection('events')
            .findOne({ entityId: booking.id, action: 'booking.cancelled' }),
        )
        await mongo.close()
      },
    )
    await t.test(
      'métricas e historial reflejan atención real y conexión SQL nueva',
      async () => {
        const metrics = (await http.get('/api/metrics').expect(200)).body.data
        assert.equal(metrics.queue.completed, 2)
        assert.ok(metrics.queue.averageWaitMinutes >= 0)
        assert.equal(metrics.bookings.revenue, 0)
        const history = (await http.get('/api/history').expect(200)).body.data
        assert.ok(
          history.some(
            (item) => item.id === booking.id && item.status === 'cancelled',
          ),
        )
        const other = new pg.Pool({ connectionString: databaseUrl.toString() })
        assert.equal(
          (
            await other.query('SELECT status FROM bookings WHERE id=$1', [
              booking.id,
            ])
          ).rows[0].status,
          'cancelled',
        )
        await other.end()
      },
    )
    await t.test(
      'sesión, CSRF, logout y aislamiento entre profesionales',
      async () => {
        await request(app).get('/api/professional/state').expect(401)
        await request(app).get('/api/bookings').expect(401)
        await request(app)
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'confirmed' })
          .expect(401)
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'missing@test.invalid', password: randomUUID() })
          .expect(401)
        await db.pool.query(
          "INSERT INTO users(id,name,role) VALUES('user-b','Profesional B','professional')",
        )
        await db.pool.query(
          "INSERT INTO professionals(id,user_id,branch_id,name) VALUES('professional-b','user-b','branch-demo','Profesional B')",
        )
        const { agent: second, login } = await authenticatedAgent(
          app,
          db.pool,
          'professional-b',
          false,
        )
        assert.match(login.headers['set-cookie'][0], /HttpOnly/)
        assert.match(login.headers['set-cookie'][0], /SameSite=Strict/)
        await second.get(`/api/bookings/${booking.id}`).expect(404)
        await second
          .patch(`/api/bookings/${booking.id}/status`)
          .send({ status: 'confirmed' })
          .expect(404)
        assert.deepEqual(
          (await second.get('/api/customers').expect(200)).body.data,
          [],
        )
        assert.deepEqual(
          (await second.get(`/api/events?entityId=${booking.id}`).expect(200))
            .body.data,
          [],
        )
        assert.equal(
          (await second.get('/api/professional/state').expect(200)).body.data
            .records.length,
          0,
        )
        await second
          .put('/api/professional/preferences')
          .set('X-CSRF-Token', 'invalid')
          .send({})
          .expect(403)
        await second
          .post('/api/tickets/next')
          .send({ moduleId: 'module-demo' })
          .expect(403)
        await request(app).get('/api/professionals/professional-b').expect(404)
        assert.equal(
          (await request(app).get('/api/professionals').expect(200)).body.data
            .length,
          1,
        )
        await second.post('/api/auth/logout').send({}).expect(200)
        await second.get('/api/professional/state').expect(401)
      },
    )
    await t.test(
      'preferencias reales, confirmación automática e identidad sin unicidad por teléfono',
      async () => {
        const current = (await http.get('/api/professional/state').expect(200))
          .body.data
        await http
          .put('/api/professional/preferences')
          .send({ ...current.preferences, bookingHorizonDays: 999 })
          .expect(400)
        await http
          .put('/api/professional/preferences')
          .send({ ...current.preferences, confirmationMode: 'automatic' })
          .expect(200)
        const a = (
          await http
            .post('/api/bookings')
            .send({
              ...input,
              id: randomUUID(),
              time: '17:00',
              customer: { name: 'Familiar Uno', phone: '+56900000050' },
            })
            .expect(201)
        ).body.data
        const b = (
          await http
            .post('/api/bookings')
            .send({
              ...input,
              id: randomUUID(),
              time: '18:00',
              customer: { name: 'Familiar Dos', phone: '+56900000050' },
            })
            .expect(201)
        ).body.data
        assert.equal(a.status, 'confirmed')
        assert.equal(a.confirmationOrigin, 'automatic')
        assert.notEqual(a.customerId, b.customerId)
        const prefs = {
          ...current.preferences,
          confirmationMode: 'manual',
          minimumAdvanceMinutes: 120,
          requestExpirationMinutes: 15,
        }
        await http.put('/api/professional/preferences').send(prefs).expect(200)
        const exp = (
          await http
            .post('/api/bookings')
            .send({ ...input, id: randomUUID(), time: '19:00' })
            .expect(201)
        ).body.data
        assert.ok(exp.expiresAt)
        await db.pool.query(
          "UPDATE bookings SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [exp.id],
        )
        await http.get('/api/professional/state').expect(200)
        assert.equal(
          (await http.get(`/api/bookings/${exp.id}`).expect(200)).body.data
            .status,
          'expired',
        )
        await http
          .put('/api/professional/preferences')
          .send(current.preferences)
          .expect(200)
      },
    )
    await t.test(
      'resultado, historial, finanzas y precio histórico provienen de la misma fuente',
      async () => {
        const record = (
          await http
            .post('/api/bookings')
            .send({ ...input, id: randomUUID(), time: '20:00' })
            .expect(201)
        ).body.data
        await http
          .patch(`/api/bookings/${record.id}/status`)
          .send({ status: 'confirmed' })
          .expect(200)
        // Fixture histórica solo dentro de la base nueva de pruebas; no se relaja el reloj de producción.
        await db.pool.query(
          "UPDATE bookings SET starts_at=now()-interval '2 hours',ends_at=now()-interval '2 hours'+duration*interval '1 minute' WHERE id=$1",
          [record.id],
        )
        await http
          .patch(`/api/bookings/${record.id}/status`)
          .send({ status: 'completed' })
          .expect(200)
        const state = (await http.get('/api/professional/state').expect(200))
          .body.data
        const client = state.customers.find((c) => c.id === record.customerId)
        assert.ok(
          client.history.some(
            (h) => h.outcome === 'completed' && h.price === 12000,
          ),
        )
        const periods = Object.values(state.financial)
        assert.ok(
          periods.some(
            (p) =>
              p.realizedIncome === 12000 &&
              p.completedServices === 1 &&
              p.averageTicket === 12000,
          ),
        )
        const services = state.services.map(
          ({
            id,
            name,
            description,
            duration,
            price,
            active,
            publicVisible,
            publicPriceVisible,
            isCustom,
          }) => ({
            id,
            name,
            description,
            duration,
            price: id === 'haircut' ? price + 1000 : price,
            active,
            publicVisible,
            publicPriceVisible,
            isCustom,
          }),
        )
        await http.put('/api/professional/services').send(services).expect(200)
        assert.equal(
          (await http.get(`/api/bookings/${record.id}`).expect(200)).body.data
            .price,
          12000,
        )
        assert.equal(
          (await http.get('/api/professional/state').expect(200)).body.data
            .financial.month.realizedIncome >= 12000,
          true,
        )
      },
    )
    await t.test(
      'deshacer restaura solicitudes competidoras y no admite reutilizar la operación',
      async () => {
        const a = (
          await http
            .post('/api/bookings')
            .send({ ...input, id: randomUUID(), time: '21:00' })
            .expect(201)
        ).body.data
        const b = (
          await http
            .post('/api/bookings')
            .send({ ...input, id: randomUUID(), time: '21:15' })
            .expect(201)
        ).body.data
        const confirmed = (
          await http
            .patch(`/api/bookings/${a.id}/status`)
            .send({ status: 'confirmed' })
            .expect(200)
        ).body.data
        assert.equal(
          (await http.get(`/api/bookings/${b.id}`).expect(200)).body.data
            .status,
          'expired',
        )
        await http
          .post('/api/professional/undo')
          .send({ token: confirmed.undoToken })
          .expect(200)
        for (const id of [a.id, b.id]) {
          const restored = (await http.get(`/api/bookings/${id}`).expect(200))
            .body.data
          assert.equal(restored.status, 'pending')
          assert.equal(restored.appointmentId, null)
        }
        await http
          .post('/api/professional/undo')
          .send({ token: confirmed.undoToken })
          .expect(409)
        const events = (
          await http.get(`/api/events?entityId=${a.id}`).expect(200)
        ).body.data
        assert.ok(events.some((e) => e.action === 'booking.undo'))
      },
    )
    await t.test(
      'ajustes preservan intervalos cerrados y propiedad de servicios personalizados',
      async () => {
        const before = (await http.get('/api/professional/state').expect(200))
          .body.data
        const { agent: other } = await authenticatedAgent(
          app,
          db.pool,
          'professional-b',
          false,
        )
        const custom = {
          id: 'local-service-owned',
          name: 'Servicio Privado',
          description: '',
          duration: 30,
          price: 5000,
          active: true,
          publicVisible: true,
          publicPriceVisible: true,
          isCustom: true,
        }
        await other.put('/api/professional/services').send([custom]).expect(200)
        const own = before.services.map(
          ({
            id,
            name,
            description,
            duration,
            price,
            active,
            publicVisible,
            publicPriceVisible,
            isCustom,
          }) => ({
            id,
            name,
            description,
            duration,
            price,
            active,
            publicVisible,
            publicPriceVisible,
            isCustom,
          }),
        )
        await http
          .put('/api/professional/services')
          .send([...own, { ...custom, name: 'No permitido' }])
          .expect(409)
        assert.equal(
          (await other.get('/api/professional/state').expect(200)).body.data
            .services[0].name,
          'Servicio Privado',
        )
        const hours = (await other.get('/api/professional/state').expect(200))
          .body.data.workingHours
        hours.days[0] = {
          day: 0,
          enabled: true,
          intervals: [{ start: '09:30', end: '12:30' }],
        }
        await other.put('/api/professional/hours').send(hours).expect(200)
        hours.days[0].enabled = false
        await other.put('/api/professional/hours').send(hours).expect(200)
        const closed = (await other.get('/api/professional/state').expect(200))
          .body.data.workingHours
        assert.deepEqual(closed.days[0].intervals, [
          { start: '09:30', end: '12:30' },
        ])
        closed.days[0].enabled = true
        await other.put('/api/professional/hours').send(closed).expect(200)
        const created = (
          await http
            .post('/api/services')
            .send({
              branchId: 'branch-demo',
              professionalId: 'professional-b',
              name: 'Servicio académico',
              duration: 15,
              price: 3000,
            })
            .expect(201)
        ).body.data
        assert.equal(created.professionalId, 'professional-b')
        assert.ok(
          (
            await other.get('/api/professional/state').expect(200)
          ).body.data.services.some((s) => s.id === created.id),
        )
      },
    )
    console.log(
      `Evidencia conservada en base aislada ${databaseName} (SQL y MongoDB).`,
    )
  },
)
