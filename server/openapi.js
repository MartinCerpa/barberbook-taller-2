import { z } from 'zod'
import { endpoints } from './routes/endpoints.js'
import { catalogs } from './validations/schemas.js'
import {
  preferencesSchema,
  profileSchema,
  hoursSchema,
  servicesSchema,
} from './services/professionalService.js'

const string = { type: 'string' },
  integer = { type: 'integer' },
  number = { type: 'number' }
const object = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
})
const array = (items) => ({ type: 'array', items })
const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const booking = object(
  {
    id: string,
    customerId: string,
    customerName: string,
    professionalId: string,
    serviceId: string,
    branchId: string,
    service: string,
    dateId: { type: 'string', format: 'date' },
    time: string,
    duration: integer,
    price: integer,
    status: {
      enum: [
        'pending',
        'confirmed',
        'rejected',
        'cancelled',
        'completed',
        'no_show',
        'expired',
      ],
    },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
  },
  ['id', 'status', 'dateId', 'time'],
)
const ticket = object(
  {
    id: string,
    number: string,
    customerName: string,
    service: string,
    branchId: string,
    moduleId: { type: ['string', 'null'] },
    professionalId: { type: ['string', 'null'] },
    status: { enum: ['pending', 'called', 'completed', 'cancelled'] },
    waitMinutes: string,
    createdAt: { type: 'string', format: 'date-time' },
    calledAt: { type: ['string', 'null'], format: 'date-time' },
    completedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  ['id', 'status', 'number'],
)
const error = object(
  {
    error: object(
      {
        message: string,
        details: { type: 'array', items: { type: 'object' } },
      },
      ['message'],
    ),
  },
  ['error'],
)
const jsonSchema = (schema) => {
  const value = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  delete value.$schema
  return value
}
const content = (schema) => ({ 'application/json': { schema } })
const schemas = {
  Error: error,
  Booking: booking,
  BookingList: array(ref('Booking')),
  Ticket: ticket,
  TicketList: array(ref('Ticket')),
  Availability: array(
    object({
      id: string,
      available: { type: 'boolean' },
      slots: array(
        object({
          time: string,
          isBookable: { type: 'boolean' },
          bookingStatus: string,
        }),
      ),
    }),
  ),
  Metrics: object({
    queue: object({
      total: integer,
      pending: integer,
      called: integer,
      completed: integer,
      averageWaitMinutes: number,
      averageServiceMinutes: number,
    }),
    bookings: object({
      total: integer,
      pending: integer,
      confirmed: integer,
      completed: integer,
      revenue: number,
    }),
  }),
  EventList: array(
    object({
      _id: string,
      entityType: string,
      entityId: string,
      action: string,
      occurredAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object' },
    }),
  ),
}
const catalogNames = {
  branches: 'Branch',
  services: 'Service',
  professionals: 'Professional',
  modules: 'Module',
}
for (const [resource, schema] of Object.entries(catalogs)) {
  schemas[catalogNames[resource]] = object(
    { id: string, ...jsonSchema(schema).properties },
    ['id', 'name', 'active'],
  )
}
const block = object(
  {
    id: string,
    professionalId: string,
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
  },
  ['id', 'professionalId', 'startsAt', 'endsAt'],
)
const responsesByAction = {
  health: object({
    status: { const: 'ok' },
    postgres: string,
    mongo: string,
    pendingEvents: integer,
  }),
  availabilityWeekly: array(
    object({
      id: string,
      professionalId: string,
      weekday: integer,
      startMinute: integer,
      endMinute: integer,
    }),
  ),
  availabilitySet: object({ updated: { const: true } }),
  blockList: array(block),
  blockCreate: block,
  blockDelete: object({ id: string }),
  customers: array(
    object({
      id: string,
      name: string,
      phone: string,
      bookings: integer,
      completed: integer,
      spent: number,
    }),
  ),
  history: array(
    object({
      id: string,
      type: { enum: ['booking', 'ticket'] },
      status: string,
      occurredAt: { type: 'string', format: 'date-time' },
    }),
  ),
}
const responseSchema = (endpoint) => {
  if (endpoint.response) return ref(endpoint.response)
  if (responsesByAction[endpoint.action])
    return responsesByAction[endpoint.action]
  const resource = endpoint.path.split('/')[1]
  if (catalogNames[resource])
    return endpoint.action.endsWith('List')
      ? array(ref(catalogNames[resource]))
      : ref(catalogNames[resource])
  throw new Error(`Falta contrato de respuesta para ${endpoint.action}`)
}

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'BarberBook · API Hito 3',
    version: '2.0.0',
    description:
      'Reservas públicas sin cuenta y panel profesional con sesión HttpOnly. Pendientes pueden competir; confirmar asigna la hora y expira solicitudes solapadas. Clientes e historial están asociados al profesional. Inicia sesión con /auth/login y usa el csrfToken devuelto en Authorize (X-CSRF-Token) para escrituras privadas. La extensión académica de sucursales/módulos/FIFO requiere administrador y está separada del recorrido principal. Zona America/Santiago. Solo datos ficticios.',
  },
  servers: [{ url: '/api' }],
  paths: {},
  components: {
    schemas,
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'barberbook_session',
        description:
          'Se establece mediante POST /auth/login; el navegador la envía automáticamente.',
      },
      csrf: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description:
          'csrfToken de la sesión; necesario en escrituras privadas.',
      },
    },
  },
}
for (const endpoint of endpoints) {
  const path = endpoint.path.replace(/:([a-z]+)/g, '{$1}')
  const parameters = []
  for (const kind of ['params', 'query']) {
    if (!endpoint[kind]) continue
    const schema = jsonSchema(endpoint[kind])
    for (const [name, property] of Object.entries(schema.properties))
      parameters.push({
        name,
        in: kind === 'params' ? 'path' : 'query',
        required: schema.required?.includes(name) || kind === 'params',
        schema: property,
      })
  }
  const responses = {
    200: {
      description:
        'Operación completada; reintentos idempotentes retornan el recurso existente.',
      content: content(object({ data: responseSchema(endpoint) }, ['data'])),
    },
  }
  if (endpoint.created)
    responses[201] = { ...responses[200], description: 'Recurso creado.' }
  for (const [code, description] of Object.entries({
    400: 'Entrada inválida.',
    404: 'Recurso inexistente o cola vacía.',
    409: 'Conflicto de integridad, ocupación o transición de estado.',
    422: 'Fecha, duración u horario fuera de disponibilidad.',
    503: 'Base de datos temporalmente indisponible.',
    500: 'Error interno.',
  }))
    responses[code] = { description, content: content(ref('Error')) }
  openapi.paths[path] ??= {}
  openapi.paths[path][endpoint.method] = {
    operationId: endpoint.action,
    summary: endpoint.summary,
    tags: [endpoint.path.split('/')[1]],
    parameters,
    responses,
    ...(endpoint.body
      ? {
          requestBody: {
            required: true,
            content: content(jsonSchema(endpoint.body)),
          },
        }
      : {}),
  }
  const publicActions = new Set([
    'health',
    'branchesList',
    'branchesGet',
    'professionalsList',
    'professionalsGet',
    'servicesList',
    'servicesGet',
    'availabilityGet',
    'availabilityWeekly',
    'bookingCreate',
  ])
  if (!publicActions.has(endpoint.action)) {
    openapi.paths[path][endpoint.method].security = [
      { session: [], ...(endpoint.method !== 'get' ? { csrf: [] } : {}) },
    ]
    responses[401] = {
      description: 'Sesión requerida.',
      content: content(ref('Error')),
    }
    responses[403] = {
      description: 'Permisos o token CSRF inválidos.',
      content: content(ref('Error')),
    }
  }
}
const extra = (method, path, summary, input, publicRoute = false) => {
  const operation = {
    summary,
    tags: [path.startsWith('/auth') ? 'auth' : 'professional'],
    responses: {
      200: {
        description:
          'Operación completada. Estado actualizado del profesional.',
        content: content(object({ data: { type: 'object' } })),
      },
      400: { description: 'Validación.', content: content(ref('Error')) },
      401: {
        description: 'Sesión requerida o credenciales inválidas.',
        content: content(ref('Error')),
      },
      403: {
        description: 'Permisos o token CSRF.',
        content: content(ref('Error')),
      },
      409: {
        description: 'Estado o disponibilidad incompatible.',
        content: content(ref('Error')),
      },
    },
  }
  if (!publicRoute)
    operation.security = [
      { session: [], ...(method !== 'get' ? { csrf: [] } : {}) },
    ]
  if (input)
    operation.requestBody = {
      required: true,
      content: content(jsonSchema(input)),
    }
  openapi.paths[path] ??= {}
  openapi.paths[path][method] = operation
}
extra(
  'post',
  '/auth/login',
  'Iniciar sesión; establece cookie HttpOnly y devuelve csrfToken',
  z.object({
    email: z.email(),
    password: z.string().min(1).max(128).meta({ writeOnly: true }),
  }),
  true,
)
extra('get', '/auth/session', 'Consultar sesión y csrfToken')
extra('post', '/auth/logout', 'Cerrar e invalidar la sesión')
extra(
  'get',
  '/professional/state',
  'Estado operativo SQL del profesional autenticado: reservas, historial, finanzas y ajustes',
)
extra(
  'put',
  '/professional/preferences',
  'Guardar automáticamente reglas validadas',
  preferencesSchema,
)
extra(
  'put',
  '/professional/hours',
  'Guardar jornada semanal sin invalidar compromisos',
  hoursSchema,
)
extra(
  'put',
  '/professional/profile',
  'Guardar manualmente identidad pública',
  profileSchema,
)
extra('delete', '/professional/profile', 'Restaurar perfil de referencia')
extra(
  'put',
  '/professional/services',
  'Guardar catálogo propio; conservar precios históricos de reservas',
  servicesSchema,
)
extra(
  'post',
  '/professional/services/restore',
  'Restaurar catálogo base sin borrar historial',
)
extra(
  'post',
  '/professional/undo',
  'Deshacer cambio propio durante dos minutos; revalida revisión y conflictos',
  z.object({ token: z.uuid() }),
)
extra(
  'put',
  '/professional/slots',
  'Bloquear, desbloquear o habilitar un horario puntual',
  z.object({
    date: z.iso.date(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    action: z.enum(['block', 'unblock', 'enable', 'restore']),
  }),
)
extra(
  'patch',
  '/professional/customers/{id}/trust',
  'Actualizar aprobación manual del cliente propio',
  z.object({ trustStatus: z.enum(['normal', 'requires_manual_approval']) }),
)
openapi.paths['/professional/customers/{id}/trust'].patch.parameters = [
  { name: 'id', in: 'path', required: true, schema: string },
]
