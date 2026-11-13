import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { pool } from '../src/database/connection.js';
import { initializeDatabase } from '../src/database/initialize.js';
import { consultarDisponibilidad, validateAvailabilityQuery } from '../src/services/availabilityService.js';
import { crearReserva } from '../src/services/bookingService.js';

test('disponibilidad y reservas con PostgreSQL real aislado', { timeout: 30000 }, async (t) => {
  t.after(() => pool.end());
  assert.match(pool.options.database, /^barberbook_t3/);
  const name = `barberbook_t3_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await pool.query(`CREATE DATABASE ${name}`);
  const db = new pg.Pool({ ...pool.options, password: pool.options.password, database: name, connectionTimeoutMillis: 5000 });
  t.after(() => db.end());
  await initializeDatabase(db, true);
  const { rows: [service] } = await db.query("SELECT * FROM services WHERE name='Barba' ORDER BY id LIMIT 1");
  const professionalId = service.professional_id;
  const { rows: [dates] } = await db.query(`SELECT
    to_char(date_trunc('week',(now() AT TIME ZONE 'America/Santiago')::date+7)::date,'YYYY-MM-DD') AS monday,
    to_char(date_trunc('week',(now() AT TIME ZONE 'America/Santiago')::date+7)::date+6,'YYYY-MM-DD') AS sunday,
    EXTRACT(YEAR FROM now())::int+1 AS year`);
  const availability = async (date, days = 1) => consultarDisponibilidad({ professionalId, serviceId: service.id, startDate: date, days }, db);
  const instant = async (date, time) => (await db.query("SELECT ($1::timestamp AT TIME ZONE 'America/Santiago') AS value", [`${date} ${time}:00`])).rows[0].value.toISOString();
  const bookingInput = async (time, date = dates.monday) => ({ serviceId: service.id, customerName: 'Cliente Prueba Disponibilidad', customerPhone: '+56900000091', startsAt: await instant(date, time) });

  await t.test('catálogo inicial de tres servicios no duplica ni sobrescribe valores existentes', async () => {
    const expected = { 'Corte de cabello': [45, 12000], 'Corte + barba': [60, 16000], 'Barba': [30, 8000] };
    const rows = (await db.query('SELECT name,duration_minutes,price FROM services WHERE professional_id=$1', [professionalId])).rows;
    assert.equal(rows.length, 3);
    for (const row of rows) assert.deepEqual([row.duration_minutes, row.price], expected[row.name]);
    await db.query('UPDATE services SET duration_minutes=35,price=8100 WHERE id=$1', [service.id]);
    await initializeDatabase(db, true);
    const preserved = (await db.query('SELECT duration_minutes,price FROM services WHERE id=$1', [service.id])).rows[0];
    assert.deepEqual(preserved, { duration_minutes: 35, price: 8100 });
    assert.equal(Number((await db.query('SELECT count(*) FROM services WHERE professional_id=$1', [professionalId])).rows[0].count), 3);
    await db.query('UPDATE services SET duration_minutes=$2,price=$3 WHERE id=$1', [service.id, service.duration_minutes, service.price]);
  });

  await t.test('cada servicio usa su duración SQL para calcular fin y cabida de la última hora', async () => {
    // Cierre a las 12:45 solo en esta base aislada: permite distinguir 30/45/60 minutos.
    await db.query('UPDATE working_hours SET end_minute=765 WHERE professional_id=$1 AND weekday=1 AND start_minute=600', [professionalId]);
    try {
      const services = (await db.query('SELECT * FROM services WHERE professional_id=$1', [professionalId])).rows;
      for (const item of services) {
        const [day] = await consultarDisponibilidad({ professionalId, serviceId: item.id, startDate: dates.monday, days: 1 }, db);
        const morning = day.slots.filter((slot) => slot.time < '13:00');
        assert.equal(morning.at(-1).time, item.duration_minutes === 60 ? '11:00' : '12:00');
        assert.ok(day.slots.every((slot) => new Date(slot.endsAt) - new Date(slot.startsAt) === item.duration_minutes * 60000));
      }
    } finally {
      await db.query('UPDATE working_hours SET end_minute=780 WHERE professional_id=$1 AND weekday=1 AND start_minute=600', [professionalId]);
    }
  });

  await t.test('inicialización repetible conserva datos y jornada existente', async () => {
    await db.query('UPDATE working_hours SET end_minute=1020 WHERE professional_id=$1 AND weekday=6', [professionalId]);
    await initializeDatabase(db, true);
    assert.equal(Number((await db.query('SELECT count(*) FROM working_hours')).rows[0].count), 11);
    assert.equal((await db.query('SELECT end_minute FROM working_hours WHERE weekday=6')).rows[0].end_minute, 1020);
    await db.query('UPDATE working_hours SET end_minute=960 WHERE weekday=6');
  });

  await t.test('valida parámetros y fechas reales de la consulta', () => {
    for (const query of [{}, { professionalId, serviceId: service.id, days: 31 },
      { professionalId, serviceId: service.id, startDate: '2027-02-30' }, { professionalId: -1, serviceId: service.id }]) {
      assert.throws(() => validateAvailabilityQuery(query), { status: 400 });
    }
    assert.equal(validateAvailabilityQuery({ professionalId: String(professionalId), serviceId: String(service.id) }).days, 14);
  });

  await t.test('horas exactas de jornada SQL, descanso y domingo cerrado', async () => {
    const [monday] = await availability(dates.monday);
    assert.deepEqual(monday.slots.map((s) => s.time), ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00']);
    assert.ok(monday.available);
    const [sunday] = await availability(dates.sunday);
    assert.equal(sunday.available, false);
    assert.deepEqual(sunday.slots, []);
    assert.equal((await availability(dates.monday, 14)).length, 14);
  });

  await t.test('duración completa debe caber en un intervalo, sin atravesar descanso', async () => {
    await db.query('UPDATE services SET duration_minutes=120 WHERE id=$1', [service.id]);
    const [day] = await availability(dates.monday);
    assert.deepEqual(day.slots.map((s) => s.time), ['10:00', '11:00', '15:00', '16:00', '17:00']);
    await assert.rejects(crearReserva(await bookingInput('12:00'), db), { status: 422 });
    await db.query('UPDATE services SET duration_minutes=30 WHERE id=$1', [service.id]);
  });

  let pending;
  await t.test('solicitudes pendientes se distinguen sin bloquear competencia manual', async () => {
    pending = await crearReserva(await bookingInput('10:00'), db);
    assert.equal(pending.status, 'pending');
    await crearReserva(await bookingInput('10:00'), db);
    const slot = (await availability(dates.monday))[0].slots.find((s) => s.time === '10:00');
    assert.equal(slot.bookingStatus, 'pending');
    assert.equal(slot.isBookable, true);
  });

  await t.test('ocupación confirmada y solapamientos se reflejan y se rechazan al registrar', async () => {
    await db.query("UPDATE bookings SET status='confirmed' WHERE id=$1", [pending.id]);
    const slot = (await availability(dates.monday))[0].slots.find((s) => s.time === '10:00');
    assert.equal(slot.bookingStatus, 'confirmed');
    assert.equal(slot.isBookable, false);
    await assert.rejects(crearReserva(await bookingInput('10:00'), db), { status: 409 });
    // Compromiso existente que solapa dos posibles inicios; solo en la base nueva de pruebas.
    const { rows: [longerService] } = await db.query("INSERT INTO services(professional_id,name,duration_minutes,price) VALUES($1,'Servicio largo de prueba',60,1000) RETURNING id", [professionalId]);
    await db.query(`INSERT INTO bookings(service_id,customer_name,customer_phone,starts_at,ends_at,status)
      VALUES($1,'Compromiso Prueba','+56900000092',$2,$3,'confirmed')`,
    [longerService.id, await instant(dates.monday, '15:15'), await instant(dates.monday, '16:15')]);
    const [day] = await availability(dates.monday);
    for (const time of ['15:00', '16:00']) {
      assert.equal(day.slots.find((s) => s.time === time).isBookable, false);
      await assert.rejects(crearReserva(await bookingInput(time), db), { status: 409 });
    }
    assert.equal(day.slots.find((s) => s.time === '17:00').isBookable, true);
  });

  await t.test('jornada, cierre, cadencia y fecha pasada se validan en backend', async () => {
    for (const time of ['09:00', '10:15', '13:00', '19:00']) {
      await assert.rejects(crearReserva(await bookingInput(time), db), { status: 422 });
    }
    await assert.rejects(crearReserva(await bookingInput('10:00', dates.sunday), db), { status: 422 });
    assert.ok((await availability('2000-01-03'))[0].slots.every((s) => !s.isBookable));
    await assert.rejects(crearReserva(await bookingInput('10:00', '2000-01-03'), db), { status: 422 });
  });

  await t.test('dos solicitudes automáticas simultáneas no confirman la misma hora', async () => {
    await db.query('UPDATE professionals SET automatic_approval=true WHERE id=$1', [professionalId]);
    const input = await bookingInput('18:00');
    const attempts = await Promise.allSettled([crearReserva(input, db), crearReserva(input, db)]);
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(attempts.find((r) => r.status === 'fulfilled').value.status, 'confirmed');
    assert.equal(attempts.find((r) => r.status === 'rejected').reason.status, 409);
  });

  await t.test('cancelación libera ocupación y mantiene solicitudes pendientes visibles', async () => {
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [pending.id]);
    const slot = (await availability(dates.monday))[0].slots.find((s) => s.time === '10:00');
    assert.equal(slot.isBookable, true);
    assert.equal(slot.bookingStatus, 'pending');
  });

  await t.test('horario de Chile cambia de offset entre verano e invierno', async () => {
    const { rows: [yearDates] } = await db.query(`SELECT
      to_char(date_trunc('week',make_date($1,1,7)),'YYYY-MM-DD') AS summer,
      to_char(date_trunc('week',make_date($1,7,7)),'YYYY-MM-DD') AS winter`, [dates.year]);
    const summer = (await availability(yearDates.summer))[0].slots[0];
    const winter = (await availability(yearDates.winter))[0].slots[0];
    assert.equal(summer.time, '10:00');
    assert.equal(winter.time, '10:00');
    assert.equal(summer.startsAt.slice(11, 16), '13:00');
    assert.equal(winter.startsAt.slice(11, 16), '14:00');
  });

  await t.test('servicio ajeno o profesional sin jornada no ofrece horas inventadas', async () => {
    const { rows: [other] } = await db.query("INSERT INTO professionals(name) VALUES('Profesional Prueba') RETURNING id");
    await assert.rejects(consultarDisponibilidad({ professionalId: other.id, serviceId: service.id }, db), { status: 404 });
    const { rows: [otherService] } = await db.query("INSERT INTO services(professional_id,name,duration_minutes,price) VALUES($1,'Servicio Prueba',30,1000) RETURNING id", [other.id]);
    const days = await consultarDisponibilidad({ professionalId: other.id, serviceId: otherService.id, startDate: dates.monday, days: 3 }, db);
    assert.ok(days.every((day) => !day.available && day.slots.length === 0));
  });
  console.log('Base aislada de pruebas conservada:', name);
});
