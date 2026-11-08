import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { bookingInput,availabilityInput,catalogs } from '../validations/schemas.js'
import { assertAcademicDatabases } from '../config/env.js'
import { createApp } from '../app.js'
import { openapi } from '../openapi.js'
import { endpoints } from '../routes/endpoints.js'

test('valida fecha real, teléfono chileno, campos y duración',() => {
  const input = { professionalId: 'p',serviceId: 's',dateId: '2027-02-28',time: '10:00',customer: { name: 'Cliente Demo',phone: '900000001' } }
  assert.equal(bookingInput.parse(input).customer.phone,'+56900000001')
  for (const change of [{ dateId: '2027-02-30' },{ time: '25:00' },{ surprise: true },{ customer: { name: 'A',phone: '123' } }]) assert.equal(bookingInput.safeParse({ ...input,...change }).success,false)
  assert.equal(catalogs.services.safeParse({ branchId: 'b',name: 'Barba',price: 100,duration: 0 }).success,false)
  assert.equal(availabilityInput.safeParse({ professionalId: 'p',weekday: 7,intervals: [] }).success,false)
  assert.equal(availabilityInput.safeParse({ professionalId: 'p',weekday: 1,intervals: [{ start: '12:00',end: '11:00' }] }).success,false)
})

test('configuración rechaza bases ajenas al proyecto académico',() => {
  assert.throws(() => assertAcademicDatabases('postgres://localhost/comercial','barberbook_hito3'))
  assert.throws(() => assertAcademicDatabases('postgres://localhost/barberbook_hito3','otra'))
  assert.doesNotThrow(() => assertAcademicDatabases('postgres://localhost/barberbook_hito3_test','barberbook_hito3_test'))
})

test('API devuelve 400 antes de acceder a persistencia y oculta errores internos',async () => {
  const db = { pool: { query: () => { throw Object.assign(new Error('credencial privada no imprimible'),{ code: 'ECONNREFUSED' }) } },mongo: {},events: {} }
  const app = createApp(db)
  await request(app).post('/api/bookings').send({}).expect(400)
  const missing = await request(app).get('/api/no-existe').expect(404)
  assert.equal(typeof missing.body.error.message,'string')
  const broken = await request(app).get('/api/services').expect(503)
  assert.equal(JSON.stringify(broken.body).includes('credencial'),false)
  await request(app).post('/api/bookings').set('Content-Type','application/json').send('{').expect(400)
  await request(app).get('/api/bookings').expect(401)
  await request(app).get('/api/availability?days=10000').expect(400)
})

test('OpenAPI y Swagger publican todas las operaciones registradas',async () => {
  const app = createApp({ pool: {},mongo: {},events: {} })
  const result = await request(app).get('/api/openapi.json').expect(200)
  assert.equal(result.body.openapi,'3.1.0')
  for (const endpoint of endpoints) {
    const path = endpoint.path.replace(/:([a-z]+)/g,'{$1}')
    assert.equal(openapi.paths[path][endpoint.method].operationId,endpoint.action)
    assert.ok(openapi.paths[path][endpoint.method].responses[409])
  }
  const html = await request(app).get('/api/docs/').expect(200)
  assert.match(html.text,/swagger-ui/)
})
