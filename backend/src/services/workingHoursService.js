import { pool } from '../database/connection.js';
import { assertBookingAvailable } from './availabilityService.js';
const fail = (status, message) => Object.assign(new Error(message), { status });
const time = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minute = (value) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : value === '24:00' ? 1440 : NaN;

export async function consultarJornada(id, database = pool) {
  const { rows } = await database.query('SELECT weekday,start_minute,end_minute FROM working_hours WHERE professional_id=$1 ORDER BY weekday,start_minute', [id]);
  return { days: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, enabled: rows.some((r) => r.weekday === day),
    intervals: rows.filter((r) => r.weekday === day).map((r) => ({ start: time(r.start_minute), end: time(r.end_minute) })) })) };
}

export async function guardarJornada(id, body, database = pool) {
  if (!body || Object.keys(body).length !== 1 || !Array.isArray(body.days) || body.days.length !== 7 || new Set(body.days.map((d) => d?.day)).size !== 7) throw fail(400, 'Envía los siete días de la semana.');
  const rows = [];
  for (const day of body.days) {
    if (!day || Object.keys(day).some((key) => !['day', 'enabled', 'intervals'].includes(key)) || !Number.isInteger(day.day) || day.day < 0 || day.day > 6 || typeof day.enabled !== 'boolean' || !Array.isArray(day.intervals) || day.intervals.length > 4 || (day.enabled && !day.intervals.length) || (!day.enabled && day.intervals.length)) throw fail(400, 'Jornada inválida: hasta cuatro intervalos por día activo; días cerrados sin intervalos.');
    const intervals = day.intervals.map((v) => {
      if (!v || Object.keys(v).length !== 2 || !Number.isFinite(minute(v.start)) || !Number.isFinite(minute(v.end)) || minute(v.start) >= minute(v.end)) throw fail(400, 'Cada intervalo necesita inicio y término válidos.');
      return { start: minute(v.start), end: minute(v.end) };
    }).sort((a, b) => a.start - b.start);
    if (intervals.some((v, i) => i && v.start < intervals[i - 1].end)) throw fail(400, 'Los intervalos de un día no pueden superponerse.');
    for (const v of intervals) rows.push([day.day, v.start, v.end]);
  }
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM professionals WHERE id=$1 FOR UPDATE', [id]);
    await client.query('DELETE FROM working_hours WHERE professional_id=$1', [id]);
    for (const row of rows) await client.query('INSERT INTO working_hours(professional_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,$4)', [id, ...row]);
    const confirmed = (await client.query(`SELECT b.*,s.professional_id FROM bookings b JOIN services s ON s.id=b.service_id
      WHERE s.professional_id=$1 AND b.status='confirmed' AND b.ends_at>clock_timestamp() ORDER BY b.starts_at`, [id])).rows;
    for (const b of confirmed) {
      try {
        await assertBookingAvailable(client, { id: b.service_id, professional_id: id, duration_minutes: (b.ends_at - b.starts_at) / 60000 }, b.starts_at.toISOString(), { excludeBookingId: b.id, ignorePast: true });
      } catch (error) {
        if (![409, 422].includes(error.status)) throw error;
        throw fail(409, `La jornada dejaría incompatible la reserva confirmada #${b.id}. Conserva su intervalo y cadencia; no se guardó ningún cambio.`);
      }
    }
    await client.query('COMMIT');
    return consultarJornada(id, database);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
