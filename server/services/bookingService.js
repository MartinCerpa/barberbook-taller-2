import { randomUUID } from 'node:crypto'
import { transaction, lockProfessional } from '../repositories/transaction.js'
import { bookingSelect, findBooking, customerId } from '../repositories/bookingRepository.js'
import { camelRow } from '../repositories/catalogRepository.js'
import { activeResources, assertAvailable, localStart } from './availabilityService.js'
import { recordEvent } from './eventService.js'
import { HttpError, requireFound } from './errors.js'

const transitions = { pending: ['confirmed','rejected','cancelled'], confirmed: ['cancelled','completed','no_show'] }
const present = (row) => ({ ...camelRow(row), appointmentId: row.status === 'confirmed' ? row.id : null })

export function bookingService(pool) {
  return {
    async list({ dateId, professionalId, limit = 100 } = {}) {
      return (await pool.query(`${bookingSelect} WHERE ($1::text IS NULL OR to_char(b.starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD')=$1)
        AND ($2::text IS NULL OR b.professional_id=$2) ORDER BY b.starts_at DESC,b.id LIMIT $3`, [dateId ?? null,professionalId ?? null,limit])).rows.map(present)
    },
    async get(id) { return present(requireFound(await findBooking(pool,id))) },
    async create(input) {
      return transaction(pool, async (client) => {
        await lockProfessional(client,input.professionalId)
        const id = input.id || randomUUID()
        const existing = await findBooking(client,id)
        if (existing) {
          if (existing.phone !== input.customer.phone || existing.customer_name !== input.customer.name || existing.professional_id !== input.professionalId ||
            existing.service_id !== input.serviceId || existing.date_id !== input.dateId || existing.time !== input.time) {
            throw new HttpError(409,'Este identificador ya corresponde a otra solicitud.')
          }
          return { booking: present(existing), created: false }
        }
        const resource = await activeResources(client,input.professionalId,input.serviceId)
        await assertAvailable(client,{ ...input,duration: resource.duration })
        const userId = await customerId(client,input.customer)
        await client.query(`INSERT INTO bookings(id,customer_id,branch_id,professional_id,service_id,duration,price,starts_at,ends_at,customer_name_snapshot)
          VALUES($1,$2,$3,$4,$5,$6::int,$7,$8::timestamp AT TIME ZONE 'America/Santiago',($8::timestamp AT TIME ZONE 'America/Santiago')+$6::int*interval '1 minute',$9)`,
        [id,userId,resource.branch_id,input.professionalId,input.serviceId,resource.duration,resource.price,localStart(input.dateId,input.time),input.customer.name])
        await recordEvent(client,'booking',id,'booking.created',{ status: 'pending' })
        return { booking: present(await findBooking(client,id)), created: true }
      })
    },
    async status(id, status) {
      return transaction(pool, async (client) => {
        const initial = requireFound(await findBooking(client,id))
        await lockProfessional(client,initial.professional_id)
        const current = requireFound(await findBooking(client,id,true))
        if (current.status === status) return present(current)
        if (!transitions[current.status]?.includes(status)) throw new HttpError(409,'Transición de estado no permitida.')
        if (status === 'confirmed') {
          await activeResources(client,current.professional_id,current.service_id)
          await assertAvailable(client,{ professionalId: current.professional_id,dateId: current.date_id,time: current.time,duration: current.duration,excludeId: id })
        }
        if (status === 'completed' && current.ends_at > new Date()) throw new HttpError(409,'La atención todavía no ha terminado.')
        if (status === 'no_show' && current.starts_at.getTime()+15*60000 > Date.now()) throw new HttpError(409,'Espera 15 minutos desde el inicio para registrar inasistencia.')
        await client.query('UPDATE bookings SET status=$2,updated_at=now() WHERE id=$1', [id,status])
        await recordEvent(client,'booking',id,`booking.${status}`,{ previousStatus: current.status, status })
        return present(await findBooking(client,id))
      })
    },
    async edit(id, input) {
      return transaction(pool, async (client) => {
        const initial = requireFound(await findBooking(client,id))
        await lockProfessional(client,initial.professional_id)
        const current = requireFound(await findBooking(client,id,true))
        if (!['pending','confirmed'].includes(current.status)) throw new HttpError(409,'Solo se editan reservas pendientes o confirmadas.')
        await activeResources(client,current.professional_id,current.service_id)
        const next = { professionalId: current.professional_id,dateId: input.dateId ?? current.date_id,time: input.time ?? current.time,duration: input.duration ?? current.duration,excludeId: id }
        await assertAvailable(client,next)
        await client.query(`UPDATE bookings SET starts_at=$2::timestamp AT TIME ZONE 'America/Santiago',
          ends_at=($2::timestamp AT TIME ZONE 'America/Santiago')+$3::int*interval '1 minute',duration=$3::int,updated_at=now() WHERE id=$1`, [id,localStart(next.dateId,next.time),next.duration])
        await recordEvent(client,'booking',id,'booking.updated',{ dateId: next.dateId,time: next.time,duration: next.duration })
        return present(await findBooking(client,id))
      })
    },
  }
}
