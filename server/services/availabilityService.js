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
      // PostgreSQL genera los intervalos con la zona horaria del negocio en una sola consulta.
      const rows = (await pool.query(`WITH days AS (
          SELECT $2::date+i AS day FROM generate_series(0,$3::int-1) i
        ), slots AS (
          SELECT d.day,d.day+minute*interval '1 minute' AS local_start
          FROM days d JOIN availability a ON a.professional_id=$1 AND a.weekday=EXTRACT(DOW FROM d.day)
          CROSS JOIN LATERAL generate_series(a.start_minute,a.end_minute-$4::int,15) minute
        ) SELECT to_char(d.day,'YYYY-MM-DD') AS id,to_char(s.local_start,'HH24:MI') AS time,
          s.local_start AT TIME ZONE 'America/Santiago' AS starts_at,
          (s.local_start AT TIME ZONE 'America/Santiago') > now()
            AND d.day <= (now() AT TIME ZONE 'America/Santiago')::date+60 AS allowed
        FROM days d LEFT JOIN slots s ON s.day=d.day ORDER BY d.day,s.local_start`,
      [professionalId,startDate,days,resource.duration])).rows
      const busy = (await pool.query(`SELECT starts_at,ends_at FROM bookings WHERE professional_id=$1
          AND status IN ('pending','confirmed','completed','no_show')
          UNION ALL SELECT starts_at,ends_at FROM availability_blocks WHERE professional_id=$1
          UNION ALL SELECT called_at,GREATEST(now(),called_at+duration*interval '1 minute') FROM tickets WHERE professional_id=$1 AND status='called'`, [professionalId])).rows
      const daysById = new Map()
      for (const row of rows) {
        if (!daysById.has(row.id)) daysById.set(row.id,{ id: row.id,slots: [],available: false })
        if (!row.time) continue
        const start=row.starts_at.getTime(),end=start+resource.duration*60000
        const isBookable=row.allowed && !busy.some((b) => start<b.ends_at.getTime() && end>b.starts_at.getTime())
        const day=daysById.get(row.id)
        day.slots.push({ time: row.time,isBookable,bookingStatus: isBookable ? 'available' : 'unavailable' })
        day.available ||= isBookable
      }
      return [...daysById.values()]
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
