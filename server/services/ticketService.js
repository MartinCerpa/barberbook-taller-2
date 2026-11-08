import { randomUUID } from 'node:crypto'
import { transaction, lockProfessional } from '../repositories/transaction.js'
import { ticketSelect, customerId } from '../repositories/bookingRepository.js'
import { camelRow } from '../repositories/catalogRepository.js'
import { recordEvent } from './eventService.js'
import { HttpError, requireFound } from './errors.js'

export function ticketService(pool) {
  const find = async (client,id) => requireFound((await client.query(`${ticketSelect} WHERE t.id=$1`, [id])).rows[0])
  return {
    async list({ branchId, limit = 100 } = {}) {
      return (await pool.query(`${ticketSelect} WHERE ($1::text IS NULL OR t.branch_id=$1) ORDER BY t.created_at DESC,t.number DESC LIMIT $2`, [branchId ?? null,limit])).rows.map(camelRow)
    },
    async get(id) { return camelRow(await find(pool,id)) },
    async create(input) {
      return transaction(pool, async (client) => {
        const id = input.id || randomUUID()
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`ticket:${id}`])
        const existing = (await client.query(`${ticketSelect} WHERE t.id=$1`, [id])).rows[0]
        if (existing) {
          const user = (await client.query('SELECT phone FROM users WHERE id=$1', [existing.customer_id])).rows[0]
          if (existing.branch_id !== input.branchId || existing.service_id !== input.serviceId || user.phone !== input.customer.phone || existing.customer_name !== input.customer.name) throw new HttpError(409,'Identificador de turno ya utilizado.')
          return { ticket: camelRow(existing), created: false }
        }
        const service = requireFound((await client.query(`SELECT s.* FROM services s JOIN branches b ON b.id=s.branch_id
          WHERE s.id=$1 AND s.branch_id=$2 AND s.active AND b.active`, [input.serviceId,input.branchId])).rows[0], 'Servicio o sucursal no disponible.')
        const userId = await customerId(client,input.customer)
        await client.query('INSERT INTO tickets(id,customer_id,branch_id,service_id,duration,customer_name_snapshot) VALUES($1,$2,$3,$4,$5,$6)', [id,userId,input.branchId,input.serviceId,service.duration,input.customer.name])
        await recordEvent(client,'ticket',id,'ticket.issued',{ status: 'pending',branchId: input.branchId })
        return { ticket: camelRow(await find(client,id)), created: true }
      })
    },
    async next(moduleId) {
      return transaction(pool, async (client) => {
        const module = requireFound((await client.query(`SELECT m.* FROM modules m JOIN professionals p ON p.id=m.professional_id
          JOIN branches b ON b.id=m.branch_id WHERE m.id=$1 AND m.active AND p.active AND b.active FOR UPDATE OF m`, [moduleId])).rows[0], 'Módulo no disponible.')
        await lockProfessional(client,module.professional_id)
        if ((await client.query("SELECT 1 FROM tickets WHERE professional_id=$1 AND status='called'", [module.professional_id])).rowCount) throw new HttpError(409,'El profesional ya tiene un turno llamado. Finalízalo primero.')
        const next = (await client.query(`SELECT t.* FROM tickets t JOIN services s ON s.id=t.service_id
          WHERE t.branch_id=$1 AND t.status='pending' AND s.active ORDER BY t.created_at,t.number FOR UPDATE OF t SKIP LOCKED LIMIT 1`, [module.branch_id])).rows[0]
        if (!next) throw new HttpError(404,'No hay turnos pendientes en esta sucursal.')
        const { rows: [check] } = await client.query(`SELECT
          EXISTS(SELECT 1 FROM availability WHERE professional_id=$1 AND weekday=EXTRACT(DOW FROM now() AT TIME ZONE 'America/Santiago')
            AND start_minute <= EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Santiago')*60+EXTRACT(MINUTE FROM now() AT TIME ZONE 'America/Santiago')
            AND end_minute >= EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Santiago')*60+EXTRACT(MINUTE FROM now() AT TIME ZONE 'America/Santiago')+$2) AS working,
          EXISTS(SELECT 1 FROM bookings WHERE professional_id=$1 AND status IN ('pending','confirmed')
            AND tstzrange(starts_at,ends_at,'[)') && tstzrange(now(),now()+$2*interval '1 minute','[)')) AS booked,
          EXISTS(SELECT 1 FROM availability_blocks WHERE professional_id=$1
            AND tstzrange(starts_at,ends_at,'[)') && tstzrange(now(),now()+$2*interval '1 minute','[)')) AS blocked`, [module.professional_id,next.duration])
        if (!check.working || check.booked || check.blocked) throw new HttpError(409,'El profesional no tiene disponibilidad suficiente ahora para este turno.')
        await client.query("UPDATE tickets SET status='called',called_at=now(),module_id=$2,professional_id=$3 WHERE id=$1", [next.id,moduleId,module.professional_id])
        await recordEvent(client,'ticket',next.id,'ticket.called',{ moduleId,professionalId: module.professional_id,status: 'called' })
        return camelRow(await find(client,next.id))
      })
    },
    async status(id, status) {
      return transaction(pool, async (client) => {
        const current = requireFound((await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id])).rows[0])
        if (current.status === status) return camelRow(await find(client,id))
        if (!(current.status === 'called' && status === 'completed') && !(current.status === 'pending' && status === 'cancelled')) throw new HttpError(409,'Transición de turno no permitida.')
        await client.query("UPDATE tickets SET status=$2,completed_at=CASE WHEN $2='completed' THEN now() ELSE NULL END WHERE id=$1", [id,status])
        await recordEvent(client,'ticket',id,`ticket.${status}`,{ previousStatus: current.status,status })
        return camelRow(await find(client,id))
      })
    },
  }
}
