import { z } from 'zod'
import { endpoints } from './routes/endpoints.js'
import { catalogs } from './validations/schemas.js'

const string = { type: 'string' }, integer = { type: 'integer' }, number = { type: 'number' }
const object = (properties,required = []) => ({ type: 'object',properties,required })
const array = (items) => ({ type: 'array',items })
const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const booking = object({ id: string,customerId: string,customerName: string,professionalId: string,serviceId: string,branchId: string,service: string,dateId: { type: 'string',format: 'date' },time: string,duration: integer,price: integer,status: { enum: ['pending','confirmed','rejected','cancelled','completed','no_show'] },startsAt: { type: 'string',format: 'date-time' },endsAt: { type: 'string',format: 'date-time' } },['id','status','dateId','time'])
const ticket = object({ id: string,number: string,customerName: string,service: string,branchId: string,moduleId: { type: ['string','null'] },professionalId: { type: ['string','null'] },status: { enum: ['pending','called','completed','cancelled'] },waitMinutes: string,createdAt: { type: 'string',format: 'date-time' },calledAt: { type: ['string','null'],format: 'date-time' },completedAt: { type: ['string','null'],format: 'date-time' } },['id','status','number'])
const error = object({ error: object({ message: string,details: { type: 'array',items: { type: 'object' } } },['message']) },['error'])
const jsonSchema = (schema) => {
  const value=z.toJSONSchema(schema,{ io: 'input',unrepresentable: 'any' })
  delete value.$schema
  return value
}
const content = (schema) => ({ 'application/json': { schema } })
const schemas = {
  Error: error,Booking: booking,BookingList: array(ref('Booking')),Ticket: ticket,TicketList: array(ref('Ticket')),
  Availability: array(object({ id: string,available: { type: 'boolean' },slots: array(object({ time: string,isBookable: { type: 'boolean' },bookingStatus: string })) })),
  Metrics: object({ queue: object({ total: integer,pending: integer,called: integer,completed: integer,averageWaitMinutes: number,averageServiceMinutes: number }),bookings: object({ total: integer,pending: integer,confirmed: integer,completed: integer,revenue: number }) }),
  EventList: array(object({ _id: string,entityType: string,entityId: string,action: string,occurredAt: { type: 'string',format: 'date-time' },metadata: { type: 'object' } })),
}
const catalogNames = { branches: 'Branch',services: 'Service',professionals: 'Professional',modules: 'Module' }
for (const [resource,schema] of Object.entries(catalogs)) {
  schemas[catalogNames[resource]] = object({ id: string,...jsonSchema(schema).properties },['id','name','active'])
}
const block = object({ id: string,professionalId: string,startsAt: { type: 'string',format: 'date-time' },endsAt: { type: 'string',format: 'date-time' } },['id','professionalId','startsAt','endsAt'])
const responsesByAction = {
  health: object({ status: { const: 'ok' },postgres: string,mongo: string,pendingEvents: integer }),
  availabilityWeekly: array(object({ id: string,professionalId: string,weekday: integer,startMinute: integer,endMinute: integer })),
  availabilitySet: object({ updated: { const: true } }),blockList: array(block),blockCreate: block,blockDelete: object({ id: string }),
  customers: array(object({ id: string,name: string,phone: string,bookings: integer,completed: integer,spent: number })),
  history: array(object({ id: string,type: { enum: ['booking','ticket'] },status: string,occurredAt: { type: 'string',format: 'date-time' } })),
}
const responseSchema = (endpoint) => {
  if (endpoint.response) return ref(endpoint.response)
  if (responsesByAction[endpoint.action]) return responsesByAction[endpoint.action]
  const resource = endpoint.path.split('/')[1]
  if (catalogNames[resource]) return endpoint.action.endsWith('List') ? array(ref(catalogNames[resource])) : ref(catalogNames[resource])
  throw new Error(`Falta contrato de respuesta para ${endpoint.action}`)
}

export const openapi = { openapi: '3.1.0',info: { title: 'BarberBook académico · Hito 3',version: '1.0.0',description: 'Reservas anticipadas y turnos presenciales. Horarios America/Santiago. Solo datos ficticios; panel académico sin autenticación. Reservas pendientes también ocupan la agenda. Errores: 400 validación, 404 inexistente, 409 conflicto/estado, 422 horario, 503 persistencia indisponible. DELETE de catálogos desactiva y conserva historial.' },servers: [{ url: '/api' }],paths: {},components: { schemas } }
for (const endpoint of endpoints) {
  const path = endpoint.path.replace(/:([a-z]+)/g,'{$1}')
  const parameters = []
  for (const kind of ['params','query']) {
    if (!endpoint[kind]) continue
    const schema = jsonSchema(endpoint[kind])
    for (const [name,property] of Object.entries(schema.properties)) parameters.push({ name,in: kind === 'params' ? 'path' : 'query',required: schema.required?.includes(name) || kind === 'params',schema: property })
  }
  const responses = { 200: { description: 'Operación completada; reintentos idempotentes retornan el recurso existente.',content: content(object({ data: responseSchema(endpoint) },['data'])) } }
  if (endpoint.created) responses[201] = { ...responses[200],description: 'Recurso creado.' }
  for (const [code,description] of Object.entries({ 400: 'Entrada inválida.',404: 'Recurso inexistente o cola vacía.',409: 'Conflicto de integridad, ocupación o transición de estado.',422: 'Fecha, duración u horario fuera de disponibilidad.',503: 'Base de datos temporalmente indisponible.',500: 'Error interno.' })) responses[code] = { description,content: content(ref('Error')) }
  openapi.paths[path] ??= {}
  openapi.paths[path][endpoint.method] = { operationId: endpoint.action,summary: endpoint.summary,tags: [endpoint.path.split('/')[1]],parameters,responses,
    ...(endpoint.body ? { requestBody: { required: true,content: content(jsonSchema(endpoint.body)) } } : {}) }
}
