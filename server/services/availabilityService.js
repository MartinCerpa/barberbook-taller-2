import { transaction, lockProfessional } from '../repositories/transaction.js'
import { HttpError, requireFound } from './errors.js'
import { randomUUID } from 'node:crypto'
import { camelRow } from '../repositories/catalogRepository.js'

export const localStart = (dateId, time) => `${dateId} ${time}:00`
export const minutes = (time) => Number(time.slice(0,2))*60 + Number(time.slice(3))

export async function activeResources(client, professionalId, serviceId) {
  return requireFound((await client.query(`SELECT p.branch_id,s.duration,s.price FROM professionals p
    JOIN branches b ON b.id=p.branch_id JOIN services s ON s.branch_id=p.branch_id
    WHERE p.id=$1 AND s.id=$2 AND p.active AND s.active AND b.active`, [professionalId,serviceId])).rows[0], 'Profesional o servicio no disponible en esta sucursal.')
}

export async function assertAvailable(client, { professionalId, dateId, time, duration, excludeId = '' }) {
  const start = localStart(dateId,time)
  const { rows: [check] } = await client.query(`SELECT
    ($2::timestamp AT TIME ZONE 'America/Santiago') > now() AS future,
    ($2::timestamp::date <= (now() AT TIME ZONE 'America/Santiago')::date + 60) AS horizon,
    EXISTS(SELECT 1 FROM availability WHERE professional_id=$1 AND weekday=EXTRACT(DOW FROM $2::timestamp)
      AND start_minute <= $3 AND end_minute >= $3+$4) AS working,
    EXISTS(SELECT 1 FROM availability_blocks WHERE professional_id=$1
      AND tstzrange(starts_at,ends_at,'[)') && tstzrange($2::timestamp AT TIME ZONE 'America/Santiago',
        ($2::timestamp AT TIME ZONE 'America/Santiago')+$4*interval '1 minute','[)')) AS blocked,
    EXISTS(SELECT 1 FROM bookings WHERE professional_id=$1 AND id<>$5
      AND status IN ('pending','confirmed','completed','no_show')
      AND tstzrange(starts_at,ends_at,'[)') && tstzrange($2::timestamp AT TIME ZONE 'America/Santiago',
        ($2::timestamp AT TIME ZONE 'America/Santiago')+$4*interval '1 minute','[)')) AS occupied,
    EXISTS(SELECT 1 FROM tickets WHERE professional_id=$1 AND status='called'
      AND tstzrange(called_at,GREATEST(now(),called_at+duration*interval '1 minute'),'[)') &&
      tstzrange($2::timestamp AT TIME ZONE 'America/Santiago',($2::timestamp AT TIME ZONE 'America/Santiago')+$4*interval '1 minute','[)')) AS attending`,
  [professionalId,start,minutes(time),duration,excludeId])
  if (!check.future || !check.horizon || !check.working) throw new HttpError(422, 'La duración debe caber en el horario laboral y la fecha debe ser futura, dentro de 60 días.')
  if (check.blocked || check.occupied || check.attending) throw new HttpError(409, 'La hora se solapa con otra reserva, bloqueo o atención.')
}

export function availabilityService(pool) {
  return {
    async get(professionalId, serviceId, startDate, days) {
      const resource = await activeResources(pool,professionalId,serviceId)
      const intervals = (await pool.query('SELECT * FROM availability WHERE professional_id=$1 ORDER BY weekday,start_minute', [professionalId])).rows
      // Una consulta por día, sin una consulta por cada posible horario.
      const results = []
      for (let offset=0; offset<days; offset++) {
        const { rows: [day] } = await pool.query(`SELECT to_char($1::date+$2::int,'YYYY-MM-DD') AS id,
          EXTRACT(DOW FROM $1::date+$2::int)::int AS weekday`, [startDate,offset])
        const busy = (await pool.query(`SELECT starts_at,ends_at FROM bookings WHERE professional_id=$1
          AND status IN ('pending','confirmed','completed','no_show')
          UNION ALL SELECT starts_at,ends_at FROM availability_blocks WHERE professional_id=$1
          UNION ALL SELECT called_at,GREATEST(now(),called_at+duration*interval '1 minute') FROM tickets WHERE professional_id=$1 AND status='called'`, [professionalId])).rows
        const slots = []
        for (const interval of intervals.filter((i) => i.weekday === day.weekday)) {
          for (let minute=interval.start_minute; minute+resource.duration<=interval.end_minute; minute+=15) {
            const time = `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`
            const { rows: [stamp] } = await pool.query(`SELECT ($1::timestamp AT TIME ZONE 'America/Santiago') AS start,
              ($1::timestamp AT TIME ZONE 'America/Santiago') > now() AND $1::timestamp::date <= (now() AT TIME ZONE 'America/Santiago')::date+60 AS allowed`, [localStart(day.id,time)])
            const start = stamp.start.getTime(), end = start + resource.duration*60000
            const isBookable = stamp.allowed && !busy.some((b) => start < b.ends_at.getTime() && end > b.starts_at.getTime())
            slots.push({ time, isBookable, bookingStatus: isBookable ? 'available' : 'unavailable' })
          }
        }
        results.push({ id: day.id, slots, available: slots.some((s) => s.isBookable) })
      }
      return results
    },
    async weekly(professionalId) {
      return (await pool.query('SELECT * FROM availability WHERE professional_id=$1 ORDER BY weekday,start_minute', [professionalId])).rows.map(camelRow)
    },
    async set(input) {
      return transaction(pool, async (client) => {
        await lockProfessional(client,input.professionalId)
        requireFound((await client.query('SELECT id FROM professionals WHERE id=$1', [input.professionalId])).rows[0])
        // No oculta citas futuras detrás de un nuevo cierre de jornada.
        const future = await client.query(`SELECT id FROM bookings WHERE professional_id=$1 AND starts_at>now()
          AND status IN ('pending','confirmed') AND EXTRACT(DOW FROM starts_at AT TIME ZONE 'America/Santiago')=$2`, [input.professionalId,input.weekday])
        if (future.rowCount) throw new HttpError(409,'Hay reservas futuras en este día semanal. Resuélvelas antes de cambiar el horario.')
        await client.query('DELETE FROM availability WHERE professional_id=$1 AND weekday=$2', [input.professionalId,input.weekday])
        for (const interval of input.intervals) await client.query('INSERT INTO availability(professional_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,$4)', [input.professionalId,input.weekday,minutes(interval.start),minutes(interval.end)])
        return { updated: true }
      })
    },
    async block(input) {
      return transaction(pool, async (client) => {
        await lockProfessional(client,input.professionalId)
        await assertAvailable(client,input)
        return camelRow((await client.query(`INSERT INTO availability_blocks(id,professional_id,starts_at,ends_at)
          VALUES($1,$2,$3::timestamp AT TIME ZONE 'America/Santiago',($3::timestamp AT TIME ZONE 'America/Santiago')+$4*interval '1 minute') RETURNING *`, [randomUUID(),input.professionalId,localStart(input.dateId,input.time),input.duration])).rows[0])
      })
    },
    async blocks() { return (await pool.query('SELECT * FROM availability_blocks ORDER BY starts_at')).rows.map(camelRow) },
    async unblock(id) {
      return requireFound((await pool.query('DELETE FROM availability_blocks WHERE id=$1 RETURNING id', [id])).rows[0])
    },
  }
}
