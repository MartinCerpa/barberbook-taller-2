import { z } from 'zod'
import * as s from '../validations/schemas.js'

const limit = z.coerce.number().int().min(1).max(500).default(100)
const optionalBranch = z.object({ branchId: s.id.optional() }).strict()
const paginated = z.object({ limit }).strict()
const params = z.object({ id: s.id }).strict()
const endpoint = (method,path,action,summary,options = {}) => ({ method,path,action,summary,...options })
export const endpoints = [
  endpoint('get','/health','health','Estado de PostgreSQL y MongoDB'),
  endpoint('get','/bookings','bookingList','Solicitudes y agenda persistidas',{ query: z.object({ dateId: s.dateId.optional(), professionalId: s.id.optional(), limit }).strict(),response: 'BookingList' }),
  endpoint('post','/bookings','bookingCreate','Crear solicitud; id permite reintentos idempotentes',{ body: s.bookingInput,response: 'Booking',created: true }),
  endpoint('get','/bookings/:id','bookingGet','Consultar una reserva',{ params,response: 'Booking' }),
  endpoint('patch','/bookings/:id/status','bookingStatus','Confirmar, rechazar, cancelar o cerrar una reserva',{ params,body: s.bookingStatus,response: 'Booking' }),
  endpoint('patch','/bookings/:id','bookingEdit','Modificar fecha, hora o duración; revalida conflictos',{ params,body: s.bookingEdit,response: 'Booking' }),
  endpoint('get','/availability','availabilityGet','Horarios según duración, jornada y preferencias; los pendientes pueden competir',{ query: z.object({ professionalId: s.id,serviceId: s.id,startDate: s.dateId,days: z.coerce.number().int().min(1).max(30).default(14) }).strict(),response: 'Availability' }),
  endpoint('get','/availability/weekly','availabilityWeekly','Consultar horario semanal en minutos',{ query: z.object({ professionalId: s.id }).strict() }),
  endpoint('put','/availability','availabilitySet','Reemplazar intervalos de un día semanal; [] cierra el día',{ body: s.availabilityInput }),
  endpoint('get','/availability/blocks','blockList','Consultar bloqueos puntuales'),
  endpoint('post','/availability/blocks','blockCreate','Crear bloqueo sin solapar reservas existentes',{ body: s.blockInput,created: true }),
  endpoint('delete','/availability/blocks/:id','blockDelete','Retirar un bloqueo',{ params }),
  endpoint('get','/tickets','ticketList','Turnos presenciales ordenados por emisión',{ query: optionalBranch.extend({ limit }),response: 'TicketList' }),
  endpoint('post','/tickets','ticketCreate','Emitir turno presencial independiente de una reserva',{ body: s.ticketInput,response: 'Ticket',created: true }),
  endpoint('post','/tickets/next','ticketNext','Llamar y asignar el siguiente turno FIFO a un módulo disponible',{ body: s.moduleInput,response: 'Ticket' }),
  endpoint('get','/tickets/:id','ticketGet','Consultar turno y espera',{ params,response: 'Ticket' }),
  endpoint('patch','/tickets/:id/status','ticketStatus','Finalizar turno llamado o cancelar turno pendiente',{ params,body: s.ticketStatus,response: 'Ticket' }),
  endpoint('get','/metrics','metrics','Métricas SQL de espera, atención, reservas e ingresos',{ query: optionalBranch,response: 'Metrics' }),
  endpoint('get','/customers','customers','Clientes ficticios y métricas de atenciones'),
  endpoint('get','/history','history','Historial de operaciones terminales desde SQL',{ query: paginated }),
  endpoint('get','/events','events','Trazabilidad real desde MongoDB, con reintento de outbox',{ query: z.object({ entityId: s.id.optional(),limit }).strict(),response: 'EventList' }),
]
for (const [resource,schema] of Object.entries(s.catalogs)) {
  endpoints.push(
    endpoint('get',`/${resource}`,`${resource}List`,`Listar ${resource}`),
    endpoint('post',`/${resource}`,`${resource}Create`,`Crear ${resource}`,{ body: schema,created: true }),
    endpoint('get',`/${resource}/:id`,`${resource}Get`,`Consultar ${resource}`,{ params }),
    endpoint('patch',`/${resource}/:id`,`${resource}Edit`,`Editar ${resource}`,{ params,body: schema.partial() }),
    endpoint('delete',`/${resource}/:id`,`${resource}Delete`,`Desactivar ${resource} sin borrar historial`,{ params }),
  )
}
