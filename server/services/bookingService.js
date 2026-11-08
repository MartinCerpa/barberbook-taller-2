import { randomUUID } from 'node:crypto'
import { transaction, lockProfessional } from '../repositories/transaction.js'
import {
  bookingSelect,
  findBooking,
  customerId,
} from '../repositories/bookingRepository.js'
import { camelRow } from '../repositories/catalogRepository.js'
import {
  activeResources,
  assertAvailable,
  localStart,
} from './availabilityService.js'
import { recordEvent } from './eventService.js'
import { HttpError, requireFound } from './errors.js'

const transitions = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['cancelled', 'completed', 'no_show'],
}
const present = (row) => ({
  ...camelRow(row),
  source: 'request',
  date: row.date_id,
  suggestedDuration: row.duration,
  appointmentId: row.confirmed_at ? `appointment-${row.id}` : null,
})
export async function expireRequests(client, professionalId) {
  const { rows } = await client.query(
    "UPDATE bookings SET status='expired',expiration_reason='timeout',revision=revision+1,updated_at=now() WHERE professional_id=$1 AND status='pending' AND expires_at<=now() RETURNING id",
    [professionalId],
  )
  for (const r of rows)
    await recordEvent(client, 'booking', r.id, 'booking.expired', {
      reason: 'timeout',
    })
}
async function expireCompetitors(client, current) {
  const { rows } = await client.query(
    `UPDATE bookings SET status='expired',expiration_reason='slot-taken',revision=revision+1,updated_at=now() WHERE professional_id=$1 AND id<>$2 AND status='pending' AND tstzrange(starts_at,ends_at,'[)') && tstzrange($3,$4,'[)') RETURNING id`,
    [current.professional_id, current.id, current.starts_at, current.ends_at],
  )
  for (const r of rows)
    await recordEvent(client, 'booking', r.id, 'booking.expired', {
      reason: 'slot-taken',
    })
}
export function bookingService(pool) {
  return {
    async list({ dateId, professionalId, limit = 100 } = {}) {
      return (
        await pool.query(
          `${bookingSelect} WHERE ($1::text IS NULL OR to_char(b.starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD')=$1) AND ($2::text IS NULL OR b.professional_id=$2) ORDER BY b.starts_at DESC,b.id LIMIT $3`,
          [dateId ?? null, professionalId ?? null, limit],
        )
      ).rows.map(present)
    },
    async get(id, professionalId) {
      const row = requireFound(await findBooking(pool, id))
      if (professionalId && row.professional_id !== professionalId)
        throw new HttpError(404, 'Reserva no encontrada.')
      return present(row)
    },
    async create(input) {
      return transaction(pool, async (client) => {
        await lockProfessional(client, input.professionalId)
        await expireRequests(client, input.professionalId)
        const id = input.id || randomUUID(),
          existing = await findBooking(client, id)
        if (existing) {
          if (
            existing.phone !== input.customer.phone ||
            existing.customer_name !== input.customer.name ||
            existing.professional_id !== input.professionalId ||
            existing.service_id !== input.serviceId ||
            existing.date_id !== input.dateId ||
            existing.time !== input.time
          )
            throw new HttpError(409, 'Identificador de solicitud ya utilizado.')
          return { booking: present(existing), created: false }
        }
        const resource = await activeResources(
          client,
          input.professionalId,
          input.serviceId,
        )
        await assertAvailable(client, { ...input, duration: resource.duration })
        const userId = await customerId(
          client,
          input.customer,
          input.professionalId,
        )
        const trust = (
          await client.query(
            'SELECT trust_status FROM professional_customers WHERE professional_id=$1 AND customer_id=$2',
            [input.professionalId, userId],
          )
        ).rows[0].trust_status
        const automatic =
          resource.preferences.confirmationMode === 'automatic' &&
          trust !== 'requires_manual_approval'
        await client.query(
          `INSERT INTO bookings(id,customer_id,branch_id,professional_id,service_id,duration,price,starts_at,ends_at,customer_name_snapshot,confirmation_origin,expires_at)
   VALUES($1,$2,$3,$4,$5,$6::int,$7,$8::timestamp AT TIME ZONE 'America/Santiago',($8::timestamp AT TIME ZONE 'America/Santiago')+$6::int*interval '1 minute',$9,$10,CASE WHEN $11::int IS NULL THEN NULL ELSE now()+$11::int*interval '1 minute' END)`,
          [
            id,
            userId,
            resource.branch_id,
            input.professionalId,
            input.serviceId,
            resource.duration,
            resource.price,
            localStart(input.dateId, input.time),
            input.customer.name,
            automatic ? 'automatic' : 'manual',
            automatic ? null : resource.preferences.requestExpirationMinutes,
          ],
        )
        await recordEvent(client, 'booking', id, 'booking.created', {
          status: 'pending',
        })
        if (automatic) {
          await client.query(
            "UPDATE bookings SET status='confirmed',confirmed_at=now(),revision=revision+1 WHERE id=$1",
            [id],
          )
          await expireCompetitors(client, await findBooking(client, id))
          await recordEvent(client, 'booking', id, 'booking.confirmed', {
            origin: 'automatic',
            status: 'confirmed',
          })
        }
        return {
          booking: present(await findBooking(client, id)),
          created: true,
        }
      })
    },
    async status(id, status, professionalId) {
      return transaction(pool, async (client) => {
        const initial = requireFound(await findBooking(client, id))
        if (professionalId && initial.professional_id !== professionalId)
          throw new HttpError(404, 'Reserva no encontrada.')
        await lockProfessional(client, initial.professional_id)
        await expireRequests(client, initial.professional_id)
        const current = requireFound(await findBooking(client, id, true))
        if (current.status === status) return present(current)
        if (!transitions[current.status]?.includes(status))
          throw new HttpError(409, 'Transición de estado no permitida.')
        if (status === 'confirmed') {
          await activeResources(
            client,
            current.professional_id,
            current.service_id,
          )
          await assertAvailable(client, {
            professionalId: current.professional_id,
            dateId: current.date_id,
            time: current.time,
            duration: current.duration,
            excludeId: id,
          })
        }
        if (status === 'completed' && current.ends_at > new Date())
          throw new HttpError(409, 'La atención todavía no ha terminado.')
        if (
          status === 'no_show' &&
          current.starts_at.getTime() + 15 * 60000 > Date.now()
        )
          throw new HttpError(
            409,
            'Espera 15 minutos desde el inicio para registrar inasistencia.',
          )
        const previous = [current]
        if (status === 'confirmed') {
          const competitors = (
            await client.query(
              "SELECT * FROM bookings WHERE professional_id=$1 AND id<>$2 AND status='pending' AND tstzrange(starts_at,ends_at,'[)') && tstzrange($3,$4,'[)')",
              [current.professional_id, id, current.starts_at, current.ends_at],
            )
          ).rows
          previous.push(...competitors)
        }
        const prefs = (
          await client.query(
            'SELECT preferences FROM professionals WHERE id=$1',
            [current.professional_id],
          )
        ).rows[0].preferences
        const late =
          status === 'cancelled' &&
          new Date().getTime() >
            current.starts_at.getTime() -
              prefs.cancellationNoticeMinutes * 60000
        await client.query(
          "UPDATE bookings SET status=$2,confirmed_at=CASE WHEN $2='confirmed' THEN now() ELSE confirmed_at END,updated_at=now(),revision=revision+1,is_late_cancellation=$3,outcome_recorded_at=CASE WHEN $2 IN ('completed','cancelled','no_show') THEN now() ELSE NULL END WHERE id=$1",
          [id, status, late],
        )
        if (status === 'confirmed') await expireCompetitors(client, current)
        if (status === 'no_show') {
          await client.query(
            `UPDATE professional_customers SET trust_status='requires_manual_approval' WHERE professional_id=$1 AND customer_id=$2 AND (SELECT COUNT(*) FROM bookings WHERE professional_id=$1 AND customer_id=$2 AND status='no_show')>=2`,
            [current.professional_id, current.customer_id],
          )
        }
        await recordEvent(client, 'booking', id, `booking.${status}`, {
          previousStatus: current.status,
          status,
        })
        let undoToken = null
        if (['confirmed', 'rejected', 'cancelled'].includes(status)) {
          undoToken = randomUUID()
          await client.query(
            'INSERT INTO booking_undo(token,professional_id,records) VALUES($1,$2,$3)',
            [
              undoToken,
              current.professional_id,
              JSON.stringify(
                previous.map((r) => ({
                  id: r.id,
                  status: r.status,
                  revision: r.revision + 1,
                  expiresAt: r.expires_at,
                  confirmedAt: r.confirmed_at,
                })),
              ),
            ],
          )
        }
        return { ...present(await findBooking(client, id)), undoToken }
      })
    },
    async edit(id, input, professionalId) {
      return transaction(pool, async (client) => {
        const initial = requireFound(await findBooking(client, id))
        if (professionalId && initial.professional_id !== professionalId)
          throw new HttpError(404, 'Reserva no encontrada.')
        await lockProfessional(client, initial.professional_id)
        await expireRequests(client, initial.professional_id)
        const current = requireFound(await findBooking(client, id, true))
        if (!['pending', 'confirmed'].includes(current.status))
          throw new HttpError(409, 'Esta reserva ya no admite cambios.')
        const next = {
          professionalId: current.professional_id,
          dateId: input.dateId ?? current.date_id,
          time: input.time ?? current.time,
          duration: input.duration ?? current.duration,
          excludeId: id,
        }
        await assertAvailable(client, next)
        await client.query(
          "UPDATE bookings SET starts_at=$2::timestamp AT TIME ZONE 'America/Santiago',ends_at=($2::timestamp AT TIME ZONE 'America/Santiago')+$3::int*interval '1 minute',duration=$3::int,updated_at=now(),revision=revision+1 WHERE id=$1",
          [id, localStart(next.dateId, next.time), next.duration],
        )
        if (current.status === 'confirmed')
          await expireCompetitors(client, await findBooking(client, id))
        await recordEvent(client, 'booking', id, 'booking.updated', {
          dateId: next.dateId,
          time: next.time,
          duration: next.duration,
        })
        return present(await findBooking(client, id))
      })
    },
    async undo(token, professionalId) {
      return transaction(pool, async (client) => {
        await lockProfessional(client, professionalId)
        const entry = requireFound(
          (
            await client.query(
              'SELECT * FROM booking_undo WHERE token=$1 AND professional_id=$2 FOR UPDATE',
              [token, professionalId],
            )
          ).rows[0],
        )
        if (entry.used_at || entry.expires_at < new Date())
          throw new HttpError(409, 'El cambio ya no se puede deshacer.')
        for (const prior of entry.records) {
          const now = requireFound(await findBooking(client, prior.id, true))
          if (
            now.revision !== prior.revision ||
            ['completed', 'no_show'].includes(now.status)
          )
            throw new HttpError(409, 'La reserva cambió; no se puede deshacer.')
          if (prior.status === 'confirmed')
            await assertAvailable(client, {
              professionalId,
              dateId: now.date_id,
              time: now.time,
              duration: now.duration,
              excludeId: now.id,
            })
        }
        for (const prior of entry.records) {
          await client.query(
            'UPDATE bookings SET status=$2,expires_at=$3,confirmed_at=$4,revision=revision+1,updated_at=now(),outcome_recorded_at=NULL,is_late_cancellation=false,expiration_reason=NULL WHERE id=$1',
            [prior.id, prior.status, prior.expiresAt, prior.confirmedAt],
          )
          await recordEvent(client, 'booking', prior.id, 'booking.undo', {
            status: prior.status,
          })
        }
        await client.query(
          'UPDATE booking_undo SET used_at=now() WHERE token=$1',
          [token],
        )
        return { restored: true }
      })
    },
  }
}
