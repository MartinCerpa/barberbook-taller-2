import { pool } from '../database/connection.js';
import { BUSINESS_TIME_ZONE, consultarDisponibilidad } from './availabilityService.js';
import { listarReservas } from './bookingService.js';

export async function consultarAgenda(id, database = pool) {
  const { rows: dates } = await database.query(`SELECT to_char(d.day,'YYYY-MM-DD') AS id,
    COALESCE(json_agg(json_build_object('startMinute',w.start_minute,'endMinute',w.end_minute) ORDER BY w.start_minute)
      FILTER(WHERE w.start_minute IS NOT NULL),'[]'::json) AS intervals
    FROM (SELECT (clock_timestamp() AT TIME ZONE $2)::date+i AS day FROM generate_series(0,13) i) d
    LEFT JOIN working_hours w ON w.professional_id=$1 AND w.weekday=EXTRACT(DOW FROM d.day)
    GROUP BY d.day ORDER BY d.day`, [id, BUSINESS_TIME_ZONE]);
  const services = (await database.query('SELECT id,name,duration_minutes FROM services WHERE professional_id=$1 AND active ORDER BY id', [id])).rows;
  const calendars = await Promise.all(services.map(async (s) => ({ service: s,
    days: await consultarDisponibilidad({ professionalId: id, serviceId: s.id, startDate: dates[0].id, days: 14 }, database) })));
  const bookings = await listarReservas(id, null, database);
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = dates.map((date, index) => {
    const slots = new Map();
    for (const calendar of calendars) {
      for (const candidate of calendar.days[index].slots) {
        const key = candidate.startsAt;
        if (!slots.has(key)) slots.set(key, { time: candidate.time, startsAt: key, services: [] });
        slots.get(key).services.push({ id: calendar.service.id, name: calendar.service.name,
          duration: calendar.service.duration_minutes, endsAt: candidate.endsAt,
          isBookable: candidate.isBookable, status: candidate.bookingStatus });
      }
    }
    return { ...date, working: date.intervals.length > 0,
      slots: [...slots.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      bookings: bookings.filter((b) => ['pending', 'confirmed'].includes(b.status) && dateFormatter.format(b.starts_at) === date.id) };
  });
  return { timeZone: BUSINESS_TIME_ZONE, days };
}
