import { pool } from '../database/connection.js';

export const BUSINESS_TIME_ZONE = 'America/Santiago';
const httpError = (status, message) => Object.assign(new Error(message), { status });

export function validateAvailabilityQuery(query) {
  const professionalId = Number(query.professionalId);
  const serviceId = Number(query.serviceId);
  const days = query.days === undefined ? 14 : Number(query.days);
  const startDate = query.startDate;
  const parsed = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? new Date(`${startDate}T12:00:00Z`) : null;
  if (!Number.isSafeInteger(professionalId) || professionalId <= 0 || !Number.isSafeInteger(serviceId) || serviceId <= 0 ||
      !Number.isInteger(days) || days < 1 || days > 30 ||
      (startDate !== undefined && (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== startDate))) {
    throw httpError(400, 'Revisa profesional, servicio, fecha inicial y cantidad de días (1 a 30).');
  }
  return { professionalId, serviceId, days, startDate: startDate ?? null };
}

// El servidor genera la oferta desde SQL. React solo presenta este resultado.
export async function consultarDisponibilidad(input, database = pool) {
  const { professionalId, serviceId, startDate = null, days = 14, durationMinutes, excludeBookingId = null, ignorePast = false } = input;
  const { rows: [service] } = await database.query(
    'SELECT duration_minutes FROM services WHERE id=$1 AND professional_id=$2 AND (active OR $3::boolean)', [serviceId, professionalId, durationMinutes !== undefined]);
  if (!service) throw httpError(404, 'El servicio no pertenece al profesional seleccionado.');
  // La confirmación conserva la duración solicitada, guardada en starts_at/ends_at.
  const duration = durationMinutes ?? service.duration_minutes;
  if (!Number.isInteger(duration) || duration <= 0) throw httpError(422, 'La duración de la reserva no es válida.');
  const { rows } = await database.query(`WITH dates AS (
      SELECT COALESCE($2::date,(now() AT TIME ZONE $5)::date)+i AS day FROM generate_series(0,$3::int-1) i
    ), slots AS (
      SELECT DISTINCT d.day, (d.day + make_interval(mins => m)) AT TIME ZONE $5 AS starts_at
      FROM dates d JOIN working_hours w ON w.professional_id=$1 AND w.weekday=EXTRACT(DOW FROM d.day)
      CROSS JOIN LATERAL generate_series(w.start_minute,w.end_minute-$4::int,60) m
    )
    SELECT to_char(d.day,'YYYY-MM-DD') AS date_id,
      to_char(s.starts_at AT TIME ZONE $5,'HH24:MI') AS time,
      s.starts_at, s.starts_at+$4::int*interval '1 minute' AS ends_at,
      s.starts_at>clock_timestamp() AS future,
      EXISTS(SELECT 1 FROM bookings b JOIN services bs ON bs.id=b.service_id
        WHERE bs.professional_id=$1 AND b.status IN ('confirmed','completed') AND ($6::int IS NULL OR b.id<>$6)
          AND b.starts_at<s.starts_at+$4::int*interval '1 minute' AND b.ends_at>s.starts_at) AS occupied,
      EXISTS(SELECT 1 FROM bookings b JOIN services bs ON bs.id=b.service_id
        WHERE bs.professional_id=$1 AND b.status='pending'
          AND b.starts_at<s.starts_at+$4::int*interval '1 minute' AND b.ends_at>s.starts_at) AS pending
    FROM dates d LEFT JOIN slots s ON s.day=d.day ORDER BY d.day,s.starts_at`,
  [professionalId, startDate, days, duration, BUSINESS_TIME_ZONE, excludeBookingId]);
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.date_id)) result.set(row.date_id, { id: row.date_id, available: false, slots: [] });
    if (!row.starts_at) continue; // Día cerrado o duración que no cabe: conservar fecha sin horas.
    const day = result.get(row.date_id);
    const future = row.future || ignorePast;
    const isBookable = future && !row.occupied;
    day.slots.push({
      time: row.time, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), isBookable,
      bookingStatus: !future ? 'unavailable' : row.occupied ? 'confirmed' : row.pending ? 'pending' : 'available',
    });
    day.available ||= isBookable;
  }
  return [...result.values()];
}

// Se ejecuta bajo el bloqueo del profesional, en la misma transacción del INSERT.
export async function assertBookingAvailable(client, service, startsAt, options = {}) {
  const { rows: [date] } = await client.query(
    "SELECT to_char($1::timestamptz AT TIME ZONE $2,'YYYY-MM-DD') AS id", [startsAt, BUSINESS_TIME_ZONE]);
  const [day] = await consultarDisponibilidad({ professionalId: service.professional_id, serviceId: service.id, startDate: date.id, days: 1,
    durationMinutes: service.duration_minutes, ...options }, client);
  const instant = new Date(startsAt).toISOString();
  const slot = day.slots.find((item) => item.startsAt === instant);
  if (!slot || slot.bookingStatus === 'unavailable') {
    throw httpError(422, 'La hora no pertenece a la jornada publicada, ya pasó o la duración no cabe en el intervalo.');
  }
  if (!slot.isBookable) throw httpError(409, 'El horario ya está reservado. Elige otra hora.');
}
