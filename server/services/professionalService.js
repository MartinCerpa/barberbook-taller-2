import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { transaction, lockProfessional } from '../repositories/transaction.js'
import { bookingService, expireRequests } from './bookingService.js'
import { camelRow } from '../repositories/catalogRepository.js'
import { HttpError, requireFound } from './errors.js'
import { calculateFinancialSummary } from '../../shared/financial.js'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const preferencesSchema = z
  .object({
    version: z.literal(1),
    confirmationMode: z.enum(['manual', 'automatic']),
    requestExpirationMinutes: z.union([
      z.literal(15),
      z.literal(30),
      z.literal(60),
      z.null(),
    ]),
    cancellationNoticeMinutes: z.number().int().min(0).max(10080),
    minimumAdvanceMinutes: z.union([
      z.literal(0),
      z.literal(30),
      z.literal(60),
      z.literal(120),
    ]),
    bookingHorizonDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  })
  .strict()
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    title: z.string().max(150),
    bio: z.string().max(1000),
    specialties: z.array(z.string().trim().min(1).max(80)).max(15),
    location: z.string().max(200),
    instagram: z
      .string()
      .max(200)
      .refine(
        (s) =>
          !s ||
          /^@?[\w.]+$/.test(s) ||
          /^https:\/\/(www\.)?instagram\.com\//.test(s),
      ),
    whatsapp: z
      .string()
      .max(30)
      .refine((s) => !s || /^\+?[\d\s()-]+$/.test(s)),
  })
  .strict()
export const hoursSchema = z
  .object({
    version: z.literal(1),
    days: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            enabled: z.boolean(),
            intervals: z
              .array(z.object({ start: time, end: time }).strict())
              .max(10),
          })
          .strict(),
      )
      .length(7),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.days.map((d) => d.day)).size !== 7)
      ctx.addIssue({ code: 'custom', message: 'Días duplicados.' })
    for (const d of v.days) {
      const list = [...d.intervals].sort((a, b) =>
        a.start.localeCompare(b.start),
      )
      if (
        (d.enabled && !list.length) ||
        list.some(
          (x, i) => x.start >= x.end || (i > 0 && x.start < list[i - 1].end),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Intervalos inválidos o solapados.',
          path: ['days', d.day],
        })
    }
  })
const serviceSchema = z
  .object({
    id: z.string().regex(/^[\w-]{1,100}$/),
    name: z.string().trim().min(2).max(80),
    description: z.string().max(500).default(''),
    duration: z.number().int().min(5).max(480),
    price: z.number().int().min(0).max(100000000),
    active: z.boolean(),
    publicVisible: z.boolean(),
    publicPriceVisible: z.boolean(),
    isCustom: z.boolean().optional(),
  })
  .strict()
export const servicesSchema = z
  .array(serviceSchema)
  .max(100)
  .refine((s) => new Set(s.map((x) => x.id)).size === s.length)
const toTime = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const profileView = (p) => ({
  ...p.profile,
  id: p.id,
  name: p.name,
  title: p.title,
  bio: p.bio,
  specialties: p.profile.specialties || ['Cortes de cabello', 'Barba'],
  location: p.profile.location || 'Santiago, Chile',
  instagram: p.profile.instagram || '',
  whatsapp: p.profile.whatsapp || '',
  profileImage: p.profile.profileImage || '',
  coverImage: p.profile.coverImage || '',
  branchId: p.branch_id,
  active: p.active,
  publicVisible: p.public_visible,
  bookingHorizonDays: p.preferences.bookingHorizonDays,
})
export function professionalService(pool) {
  const bookings = bookingService(pool)
  return {
    async state(id) {
      await transaction(pool, async (c) => {
        await lockProfessional(c, id)
        await expireRequests(c, id)
      })
      const p = requireFound(
        (await pool.query('SELECT * FROM professionals WHERE id=$1', [id]))
          .rows[0],
      )
      const records = await bookings.list({ professionalId: id, limit: 10000 })
      const services = (
        await pool.query(
          'SELECT * FROM services WHERE professional_id=$1 ORDER BY name,id',
          [id],
        )
      ).rows.map((r) => ({
        ...camelRow(r),
        isCustom: !['haircut', 'haircut-beard', 'beard'].includes(r.id),
      }))
      const intervals = (
        await pool.query(
          'SELECT * FROM availability WHERE professional_id=$1 ORDER BY weekday,start_minute',
          [id],
        )
      ).rows
      const workingHours = {
        version: 1,
        days: Array.from({ length: 7 }, (_, day) => ({
          day,
          enabled: intervals.some((i) => i.weekday === day),
          intervals: intervals.some((i) => i.weekday === day)
            ? intervals
                .filter((i) => i.weekday === day)
                .map((i) => ({
                  start: toTime(i.start_minute),
                  end: toTime(i.end_minute),
                }))
            : p.inactive_hours[String(day)] || [],
        })),
      }
      const rows = (
        await pool.query(
          `SELECT u.*,pc.created_at,pc.trust_status,pc.notes,pc.favorite_service FROM professional_customers pc JOIN users u ON u.id=pc.customer_id WHERE pc.professional_id=$1 AND NOT pc.archived`,
          [id],
        )
      ).rows
      const customers = rows.map((c) => {
        const own = records.filter((r) => r.customerId === c.id),
          history = own
            .filter(
              (r) =>
                r.appointmentId &&
                ['completed', 'cancelled', 'no_show'].includes(r.status),
            )
            .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
            .map((r) => ({
              appointmentId: r.appointmentId,
              date: r.dateId,
              time: r.time,
              serviceId: r.serviceId,
              service: r.service,
              price: r.price,
              duration: r.duration,
              outcome: r.status,
              recordedAt: r.outcomeRecordedAt,
              isLateCancellation: r.isLateCancellation,
            }))
        const completed = history.filter((h) => h.outcome === 'completed'),
          next = own
            .filter(
              (r) =>
                r.status === 'confirmed' && new Date(r.startsAt) >= new Date(),
            )
            .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0]
        return {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          createdAt: c.created_at.toISOString().slice(0, 10),
          trustStatus: c.trust_status,
          notes: c.notes,
          favoriteService: c.favorite_service || 'Por definir',
          history,
          completedAppointments: completed.length,
          totalAppointments: own.filter((r) => r.appointmentId).length,
          totalSpent: completed.reduce((sum, r) => sum + r.price, 0),
          lastVisit: completed[0]?.date || null,
          nextAppointment: next
            ? { date: next.dateId, time: next.time, service: next.service }
            : null,
          noShows: history.filter((r) => r.outcome === 'no_show').length,
          lateCancellations: history.filter((r) => r.isLateCancellation).length,
        }
      })
      const clock = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }),
        ),
        todayDateId = `${clock.getFullYear()}-${String(clock.getMonth() + 1).padStart(2, '0')}-${String(clock.getDate()).padStart(2, '0')}`
      const financial = Object.fromEntries(
        ['today', 'week', 'month'].map((period) => [
          period,
          calculateFinancialSummary(records, period, clock),
        ]),
      )
      const daily = records.filter(
        (r) =>
          r.dateId === todayDateId &&
          ['confirmed', 'completed'].includes(r.status),
      )
      const dashboardSummary = {
        pendingRequests: records.filter(
          (r) => r.status === 'pending' && new Date(r.startsAt) >= new Date(),
        ).length,
        todayDateId,
        financial: financial.today,
        nextAppointment:
          records
            .filter(
              (r) =>
                r.status === 'confirmed' && new Date(r.startsAt) >= new Date(),
            )
            .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] ||
          null,
        dailyOperations: {
          totalAppointments: daily.length,
          completedAppointments: daily.filter((r) => r.status === 'completed')
            .length,
          confirmedAppointments: daily.filter((r) => r.status === 'confirmed')
            .length,
          clientsToday: new Set(daily.map((r) => r.customerId)).size,
        },
      }
      const blocks = (
        await pool.query(
          `SELECT id,to_char(starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS date,to_char(starts_at AT TIME ZONE 'America/Santiago','HH24:MI') AS time FROM availability_blocks WHERE professional_id=$1`,
          [id],
        )
      ).rows
      const enabled = (
        await pool.query(
          "SELECT id,to_char(date_id,'YYYY-MM-DD') AS date,time FROM availability_exceptions WHERE professional_id=$1",
          [id],
        )
      ).rows
      return {
        professional: profileView(p),
        preferences: p.preferences,
        services,
        workingHours,
        records,
        customers,
        blocks,
        enabled,
        financial,
        dashboardSummary,
      }
    },
    async preferences(id, value) {
      const preferences = preferencesSchema.parse(value)
      await pool.query('UPDATE professionals SET preferences=$2 WHERE id=$1', [
        id,
        preferences,
      ])
      return preferences
    },
    async profile(id, value) {
      const v = profileSchema.parse(value)
      await pool.query(
        'UPDATE professionals SET name=$2,title=$3,bio=$4,profile=$5 WHERE id=$1',
        [id, v.name, v.title, v.bio, v],
      )
      return v
    },
    async restoreProfile(id) {
      await pool.query(
        "UPDATE professionals SET name=profile_baseline->>'name',title=profile_baseline->>'title',bio=profile_baseline->>'bio',profile='{}' WHERE id=$1",
        [id],
      )
      return { restored: true }
    },
    async hours(id, value) {
      const hours = hoursSchema.parse(value)
      return transaction(pool, async (c) => {
        await lockProfessional(c, id)
        const future = (
          await c.query(
            `SELECT to_char(starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS date,
              to_char(starts_at AT TIME ZONE 'America/Santiago','HH24:MI') AS time_part,
              EXTRACT(HOUR FROM ends_at AT TIME ZONE 'America/Santiago')*60+EXTRACT(MINUTE FROM ends_at AT TIME ZONE 'America/Santiago') AS end
              FROM bookings WHERE professional_id=$1 AND starts_at>now() AND status IN ('pending','confirmed')`,
            [id],
          )
        ).rows
        for (const b of future) {
          const day = hours.days.find(
            (d) => d.day === new Date(`${b.date}T12:00:00Z`).getUTCDay(),
          )
          const start =
            Number(b.time_part.slice(0, 2)) * 60 + Number(b.time_part.slice(3))
          if (
            !day?.enabled ||
            !day.intervals.some(
              (i) =>
                Number(i.start.slice(0, 2)) * 60 + Number(i.start.slice(3)) <=
                  start &&
                Number(i.end.slice(0, 2)) * 60 + Number(i.end.slice(3)) >=
                  Number(b.end),
            )
          )
            throw new HttpError(
              409,
              'El horario dejaría una reserva futura fuera de jornada.',
            )
        }
        await c.query('DELETE FROM availability WHERE professional_id=$1', [id])
        await c.query(
          'UPDATE professionals SET inactive_hours=$2 WHERE id=$1',
          [
            id,
            Object.fromEntries(
              hours.days
                .filter((d) => !d.enabled)
                .map((d) => [String(d.day), d.intervals]),
            ),
          ],
        )
        for (const d of hours.days.filter((d) => d.enabled))
          for (const i of d.intervals)
            await c.query(
              'INSERT INTO availability(professional_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,$4)',
              [
                id,
                d.day,
                Number(i.start.slice(0, 2)) * 60 + Number(i.start.slice(3)),
                Number(i.end.slice(0, 2)) * 60 + Number(i.end.slice(3)),
              ],
            )
        return hours
      })
    },
    async services(id, input) {
      const list = servicesSchema.parse(input)
      return transaction(pool, async (c) => {
        await lockProfessional(c, id)
        const p = requireFound(
          (
            await c.query('SELECT branch_id FROM professionals WHERE id=$1', [
              id,
            ])
          ).rows[0],
        )
        const existing = (
          await c.query('SELECT id FROM services WHERE professional_id=$1', [
            id,
          ])
        ).rows.map((r) => r.id)
        for (const s of list) {
          if (!existing.includes(s.id) && !s.id.startsWith('local-service-'))
            throw new HttpError(
              409,
              'Identificador de servicio ajeno o inválido.',
            )
          const saved = await c.query(
            `INSERT INTO services(id,branch_id,professional_id,name,description,duration,price,active,public_visible,public_price_visible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET name=$4,description=$5,duration=$6,price=$7,active=$8,public_visible=$9,public_price_visible=$10 WHERE services.professional_id=$3 RETURNING id`,
            [
              s.id,
              p.branch_id,
              id,
              s.name,
              s.description,
              s.duration,
              s.price,
              s.active,
              s.publicVisible,
              s.publicPriceVisible,
            ],
          )
          if (!saved.rowCount)
            throw new HttpError(
              409,
              'El servicio pertenece a otro profesional.',
            )
        }
        for (const old of existing.filter((x) => !list.some((s) => s.id === x)))
          await c.query(
            'UPDATE services SET active=false WHERE id=$1 AND professional_id=$2',
            [old, id],
          )
        return { saved: true }
      })
    },
    async restoreServices(id) {
      await transaction(pool, async (c) => {
        await lockProfessional(c, id)
        await c.query(
          'UPDATE services SET active=false WHERE professional_id=$1',
          [id],
        )
        for (const [key, name, duration, price] of [
          ['haircut', 'Corte de cabello', 45, 12000],
          ['haircut-beard', 'Corte + barba', 60, 16000],
          ['beard', 'Barba', 30, 8000],
        ])
          await c.query(
            'UPDATE services SET name=$3,duration=$4,price=$5,active=true WHERE professional_id=$1 AND id=$2',
            [id, key, name, duration, price],
          )
      })
      return { restored: true }
    },
    async trust(id, customerId, status) {
      requireFound(
        (
          await pool.query(
            'UPDATE professional_customers SET trust_status=$3 WHERE professional_id=$1 AND customer_id=$2 RETURNING customer_id',
            [id, customerId, status],
          )
        ).rows[0],
      )
      return { saved: true }
    },
    async exception(id, date, time, remove = false) {
      if (remove)
        await pool.query(
          'DELETE FROM availability_exceptions WHERE professional_id=$1 AND date_id=$2 AND time=$3',
          [id, date, time],
        )
      else
        await pool.query(
          'INSERT INTO availability_exceptions(id,professional_id,date_id,time) VALUES($1,$2,$3,$4) ON CONFLICT(professional_id,date_id,time) DO NOTHING',
          [randomUUID(), id, date, time],
        )
      return { saved: true }
    },
  }
}
