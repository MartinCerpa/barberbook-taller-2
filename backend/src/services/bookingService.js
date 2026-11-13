import { pool } from '../database/connection.js';
import { assertBookingAvailable } from './availabilityService.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const storedService = (booking) => ({ id: booking.service_id, professional_id: booking.professional_id,
  duration_minutes: (booking.ends_at - booking.starts_at) / 60000 });

// FIFO entre solicitudes solapadas: solo bloquean las anteriores que aún son elegibles.
async function earlierEligibleRequest(client, booking) {
  const { rows } = await client.query(`SELECT b.*,s.professional_id FROM bookings b JOIN services s ON s.id=b.service_id
    JOIN bookings target ON target.id=$2
    WHERE s.professional_id=$1 AND b.status='pending' AND (b.created_at,b.id)<(target.created_at,target.id)
      AND b.starts_at<target.ends_at AND b.ends_at>target.starts_at ORDER BY b.created_at,b.id`,
  [booking.professional_id, booking.id]);
  for (const previous of rows) {
    try {
      await assertBookingAvailable(client, storedService(previous), previous.starts_at.toISOString());
      return previous;
    } catch (error) {
      if (![409, 422].includes(error.status)) throw error;
    }
  }
  return null;
}

export async function crearReserva(datos, database = pool) {
  const client = await database.connect();

  try {
    await client.query('BEGIN');

    // Leer el catálogo después de tomar el bloqueo compartido con sus ediciones.
    await client.query('SELECT id FROM professionals WHERE id=(SELECT professional_id FROM services WHERE id=$1) FOR UPDATE', [datos.serviceId]);

    const { rows: servicios } = await client.query(
      `SELECT s.id, s.professional_id, s.duration_minutes, s.name, s.price,
              p.automatic_approval
       FROM services s
       JOIN professionals p ON p.id = s.professional_id
       WHERE s.id = $1 AND s.active`,
      [datos.serviceId]
    );

    const servicio = servicios[0];

    if (!servicio) {
      const error = new Error('Servicio no encontrado');
      error.status = 404;
      throw error;
    }

    const inicio = new Date(datos.startsAt);
    const fin = new Date(
      inicio.getTime() + servicio.duration_minutes * 60000
    );

    await assertBookingAvailable(client, servicio, datos.startsAt);

    const { rows } = await client.query(
      `INSERT INTO bookings
       (service_id, customer_name, customer_phone,
        starts_at, ends_at, status, created_at, service_name_snapshot, service_price_snapshot)
       VALUES ($1, $2, $3, $4, $5, 'pending', clock_timestamp(), $6, $7)
       RETURNING *`,
      [
        servicio.id,
        datos.customerName,
        datos.customerPhone,
        inicio,
        fin,
        servicio.name,
        servicio.price
      ]
    );

    let booking = rows[0];
    if (servicio.automatic_approval && !await earlierEligibleRequest(client, { ...booking, professional_id: servicio.professional_id })) {
      booking = (await client.query("UPDATE bookings SET status='confirmed' WHERE id=$1 RETURNING *", [booking.id])).rows[0];
    }
    await client.query('COMMIT');
    return booking;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listarReservas(professionalId, status, database = pool) {
  const { rows } = await database.query(`SELECT b.*,COALESCE(b.service_name_snapshot,s.name) AS service_name,s.professional_id
    FROM bookings b JOIN services s ON s.id=b.service_id
    WHERE s.professional_id=$1 AND ($2::text IS NULL OR b.status=$2)
    ORDER BY b.created_at,b.id`, [professionalId, status ?? null]);
  return rows;
}

export async function cambiarEstadoReserva(professionalId, bookingId, status, database = pool) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    // Mismo bloqueo que la creación pública: confirmación, creación y configuración se serializan.
    await client.query('SELECT id FROM professionals WHERE id=$1 FOR UPDATE', [professionalId]);
    const { rows: [booking] } = await client.query(`SELECT b.*,s.professional_id FROM bookings b JOIN services s ON s.id=b.service_id
      WHERE b.id=$1 AND s.professional_id=$2 FOR UPDATE OF b`, [bookingId, professionalId]);
    if (!booking) throw httpError(404, 'Reserva no encontrada.');
    if (!['confirmed', 'rejected'].includes(status)) throw httpError(400, 'Solo puedes confirmar o rechazar solicitudes.');
    if (booking.status === status) { await client.query('COMMIT'); return booking; }
    if (booking.status !== 'pending') throw httpError(409, 'Esta reserva ya no es una solicitud pendiente.');
    if (status === 'confirmed') {
      await assertBookingAvailable(client, storedService(booking), booking.starts_at.toISOString());
      const previous = await earlierEligibleRequest(client, booking);
      if (previous) throw httpError(409, `FIFO: resuelve primero la solicitud anterior #${previous.id} que compite por esta hora.`);
    }
    const { rows: [updated] } = await client.query('UPDATE bookings SET status=$2 WHERE id=$1 RETURNING *', [bookingId, status]);
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
