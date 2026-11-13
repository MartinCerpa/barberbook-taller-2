import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import { pool } from '../src/database/connection.js';
import { initializeDatabase } from '../src/database/initialize.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/authService.js';

test('Agenda y configuración: HTTP y PostgreSQL aislado', { timeout: 90000 }, async (t) => {
  t.after(() => pool.end());
  assert.match(pool.options.database, /^barberbook_t3/);
  const name = `barberbook_t3_config_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await pool.query(`CREATE DATABASE ${name}`);
  const db = new pg.Pool({ ...pool.options, password: pool.options.password, database: name, connectionTimeoutMillis: 5000 }); t.after(() => db.end());
  await initializeDatabase(db, true);
  const { rows: [owner] } = await db.query('SELECT id FROM professionals ORDER BY id LIMIT 1');
  const { rows: [other] } = await db.query("INSERT INTO professionals(name) VALUES('Otro profesional de prueba') RETURNING id");
  const secret = randomUUID();
  await db.query('UPDATE professionals SET email=$2,password_hash=$3 WHERE id=$1', [owner.id, 'config@test.invalid', await hashPassword(secret)]);
  const server = createApp(db).listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie, csrf;
  async function request(path, { method = 'GET', body, authenticated = true, token = csrf } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authenticated && cookie) headers.Cookie = cookie;
    if (authenticated && token) headers['X-CSRF-Token'] = token;
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
  }
  const login = await request('/auth/login', { method: 'POST', body: { email: 'config@test.invalid', password: secret } });
  cookie = login.cookie.split(';')[0]; csrf = login.body.data.csrfToken;
  const originalHours = (await request('/professional/working-hours')).body.data;
  const { rows: [clock] } = await db.query("SELECT to_char(date_trunc('week',(now() AT TIME ZONE 'America/Santiago')::date+7)::date,'YYYY-MM-DD') AS monday");
  const instant = async (time, plusDays = 0) => (await db.query("SELECT (($1::date+$2::int)::text||' '||$3)::timestamp AT TIME ZONE 'America/Santiago' AS value", [clock.monday, plusDays, time])).rows[0].value.toISOString();
  let service, booking;
  const update = (body) => request(`/professional/services/${service.id}`, { method: 'PATCH', body });
  const hours = (body) => request('/professional/working-hours', { method: 'PUT', body });
  const availability = async () => request(`/availability?professionalId=${owner.id}&serviceId=${service.id}&startDate=${clock.monday}&days=1`, { authenticated: false });

  await t.test('rutas privadas exigen sesión, CSRF y no aceptan identidad enviada por el cliente', async () => {
    for (const path of ['profile', 'services', 'working-hours', 'agenda']) assert.equal((await request(`/professional/${path}`, { authenticated: false })).status, 401);
    for (const [path, method, body] of [['profile', 'PATCH', { name: 'X' }], ['services', 'POST', { name: 'X', duration_minutes: 30, price: 100 }], ['working-hours', 'PUT', originalHours]]) {
      assert.equal((await request(`/professional/${path}`, { method, body, token: '' })).status, 403);
    }
    assert.equal((await request('/professional/profile', { method: 'PATCH', body: { professional_id: other.id, name: 'Ajeno' } })).status, 400);
    assert.equal((await request(`/professional/agenda?professionalId=${other.id}`)).status, 400);
  });

  await t.test('perfil persiste y aparece públicamente sin publicar credenciales', async () => {
    const body = { name: 'Matías de prueba', bio: 'Biografía de prueba', title: 'Barbero', specialties: ['Corte clásico'], location: 'Ubicación ficticia', instagram: '@prueba_barber', whatsapp: '+56900000000' };
    assert.equal((await request('/professional/profile', { method: 'PATCH', body })).status, 200);
    const profile = (await request('/professional/profile')).body.data;
    for (const [key, value] of Object.entries(body)) assert.deepEqual(profile[key], value);
    const visible = (await request('/professionals')).body.data.find((p) => p.id === owner.id);
    assert.equal(visible.bio, body.bio); assert.deepEqual(visible.specialties, body.specialties);
    assert.equal('password_hash' in visible, false); assert.equal('email' in visible, false);
    assert.equal((await request('/professional/profile', { method: 'PATCH', body: { name: '' } })).status, 400);
    assert.equal((await request('/professional/profile', { method: 'PATCH', body: { instagram: 'javascript:alert(1)' } })).status, 400);
  });

  await t.test('crear, editar y validar servicios sin duplicar nombres', async () => {
    const created = await request('/professional/services', { method: 'POST', body: { name: 'Servicio editable', duration_minutes: 45, price: 12345 } });
    assert.equal(created.status, 201); service = created.body.data;
    assert.equal((await request('/professional/services', { method: 'POST', body: { name: ' servicio EDITABLE ', duration_minutes: 30, price: 100 } })).status, 409);
    for (const body of [{ duration_minutes: 0 }, { duration_minutes: 31 }, { price: -1 }, { price: '100' }, { active: 'false' }, { name: ' ' }, { professional_id: other.id }]) assert.equal((await update(body)).status, 400);
    const day = (await availability()).body.data[0]; assert.ok(day.slots.every((s) => new Date(s.endsAt) - new Date(s.startsAt) === 45 * 60000));
  });

  await t.test('reservas conservan nombre, precio y duración al editar el catálogo', async () => {
    const r = await request('/bookings', { method: 'POST', body: { serviceId: service.id, customerName: 'Cliente ficticio', customerPhone: '+56900000000', startsAt: await instant('10:00') } });
    assert.equal(r.status, 201); booking = r.body.data;
    assert.equal((await update({ name: 'Servicio renombrado', price: 20000, duration_minutes: 60 })).status, 200);
    const stored = (await request('/professional/bookings?status=pending')).body.data.find((b) => b.id === booking.id);
    assert.equal(stored.service_name, 'Servicio editable'); assert.equal(stored.service_price_snapshot, 12345);
    assert.equal(new Date(stored.ends_at) - new Date(stored.starts_at), 45 * 60000);
    assert.ok((await availability()).body.data[0].slots.every((s) => new Date(s.endsAt) - new Date(s.startsAt) === 60 * 60000));
  });

  await t.test('desactivar oculta el servicio e impide reservas nuevas, conservando la confirmación histórica', async () => {
    assert.equal((await update({ active: false })).status, 200);
    assert.equal((await request('/services')).body.data.some((s) => s.id === service.id), false);
    assert.equal((await availability()).status, 404);
    assert.equal((await request('/bookings', { method: 'POST', body: { serviceId: service.id, customerName: 'Prueba', customerPhone: '+56900000000', startsAt: await instant('11:00') } })).status, 404);
    assert.equal((await request(`/professional/bookings/${booking.id}/status`, { method: 'PATCH', body: { status: 'confirmed' } })).status, 200);
    assert.equal((await update({ active: true })).status, 200);
  });

  await t.test('agenda entrega 14 días consecutivos, cerrados y sin reservas; respeta ocupación confirmada', async () => {
    const agenda = (await request('/professional/agenda')).body.data;
    assert.equal(agenda.timeZone, 'America/Santiago'); assert.equal(agenda.days.length, 14);
    const today = (await db.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS id")).rows[0].id;
    assert.equal(agenda.days[0].id, today);
    for (let i = 1; i < 14; i++) assert.equal((new Date(agenda.days[i].id) - new Date(agenda.days[i - 1].id)) / 86400000, 1);
    const sunday = agenda.days.find((d) => new Date(`${d.id}T12:00Z`).getUTCDay() === 0);
    assert.equal(sunday.working, false); assert.deepEqual(sunday.slots, []);
    assert.ok(agenda.days.some((d) => !d.bookings.length && d.working && d.slots.length));
    const monday = agenda.days.find((d) => d.id === clock.monday);
    assert.equal(monday.bookings.find((b) => b.id === booking.id).status, 'confirmed');
    assert.ok(monday.slots.find((s) => s.time === '10:00').services.every((s) => !s.isBookable));
  });

  await t.test('horarios múltiples y días deshabilitados persisten y modifican disponibilidad', async () => {
    const changed = structuredClone(originalHours);
    changed.days.find((d) => d.day === 1).intervals = [{ start: '10:00', end: '12:00' }, { start: '16:00', end: '18:00' }];
    changed.days.find((d) => d.day === 6).enabled = false; changed.days.find((d) => d.day === 6).intervals = [];
    assert.equal((await hours(changed)).status, 200);
    assert.deepEqual((await request('/professional/working-hours')).body.data, changed);
    assert.deepEqual((await availability()).body.data[0].slots.map((s) => s.time), ['10:00', '11:00', '16:00', '17:00']);
    const agenda = (await request('/professional/agenda')).body.data;
    assert.ok(agenda.days.filter((d) => new Date(`${d.id}T12:00Z`).getUTCDay() === 6).every((d) => !d.working));
    assert.equal((await hours(originalHours)).status, 200);
  });

  await t.test('intervalos inválidos/superpuestos no modifican la jornada guardada', async () => {
    for (const intervals of [[{ start: '11:00', end: '10:00' }], [{ start: '10:00', end: '12:00' }, { start: '11:00', end: '13:00' }], [{ start: 'xx', end: '13:00' }]]) {
      const bad = structuredClone(originalHours); bad.days.find((d) => d.day === 1).intervals = intervals;
      assert.equal((await hours(bad)).status, 400);
    }
    assert.deepEqual((await request('/professional/working-hours')).body.data, originalHours);
  });

  await t.test('jornada protege intervalo y cadencia de reservas confirmadas con rollback completo', async () => {
    for (const intervals of [[{ start: '10:00', end: '10:30' }], [{ start: '09:30', end: '13:00' }], []]) {
      const bad = structuredClone(originalHours); const monday = bad.days.find((d) => d.day === 1); monday.enabled = !!intervals.length; monday.intervals = intervals;
      assert.equal((await hours(bad)).status, 409);
      assert.deepEqual((await request('/professional/working-hours')).body.data, originalHours);
    }
  });

  await t.test('ninguna modificación puede actuar sobre servicios de otro profesional', async () => {
    const foreign = (await db.query("INSERT INTO services(professional_id,name,duration_minutes,price) VALUES($1,'Ajeno',30,1000) RETURNING id", [other.id])).rows[0];
    assert.equal((await request(`/professional/services/${foreign.id}`, { method: 'PATCH', body: { price: 99 } })).status, 404);
    assert.equal((await request('/professional/services')).body.data.some((s) => s.id === foreign.id), false);
    assert.equal((await db.query('SELECT price FROM services WHERE id=$1', [foreign.id])).rows[0].price, 1000);
    assert.equal((await db.query('SELECT name FROM professionals WHERE id=$1', [other.id])).rows[0].name, 'Otro profesional de prueba');
  });

  await t.test('editar jornada y crear una reserva automática concurrente nunca deja una confirmada fuera de jornada', async () => {
    await request('/professional/settings', { method: 'PATCH', body: { automatic_approval: true } });
    const closed = structuredClone(originalHours); const wednesday = closed.days.find((d) => d.day === 3); wednesday.enabled = false; wednesday.intervals = [];
    const [changed, created] = await Promise.all([hours(closed), request('/bookings', { method: 'POST', body: {
      serviceId: service.id, customerName: 'Concurrencia ficticia', customerPhone: '+56900000000', startsAt: await instant('10:00', 2),
    } })]);
    assert.ok((changed.status === 200 && created.status === 422) || (changed.status === 409 && created.status === 201));
    if (created.status === 201) assert.equal(created.body.data.status, 'confirmed');
    assert.equal((await hours(originalHours)).status, 200);
    await request('/professional/settings', { method: 'PATCH', body: { automatic_approval: false } });
  });

  await t.test('editar duración y reservar concurrentemente conserva una oferta y precio coherentes', async () => {
    const [edited, created] = await Promise.all([update({ duration_minutes: 120, price: 21000 }), request('/bookings', { method: 'POST', body: {
      serviceId: service.id, customerName: 'Catálogo concurrente ficticio', customerPhone: '+56900000000', startsAt: await instant('18:00', 3),
    } })]);
    assert.equal(edited.status, 200); assert.ok([201, 422].includes(created.status));
    if (created.status === 201) {
      assert.equal(new Date(created.body.data.ends_at) - new Date(created.body.data.starts_at), 60 * 60000);
      assert.equal(created.body.data.service_price_snapshot, 20000);
    }
  });

  await t.test('inicio idempotente no duplica al profesional renombrado ni repone servicios o días cerrados', async () => {
    await db.query('UPDATE services SET active=false WHERE id=$1', [service.id]);
    await db.query('DELETE FROM working_hours WHERE professional_id=$1', [other.id]);
    const before = (await db.query('SELECT count(*) FROM services')).rows[0].count;
    const credentials = (await db.query('SELECT password_hash FROM professionals WHERE id=$1', [owner.id])).rows[0].password_hash;
    await initializeDatabase(db, true); await initializeDatabase(db, true);
    assert.equal((await db.query('SELECT count(*) FROM professionals')).rows[0].count, '2');
    assert.equal((await db.query('SELECT count(*) FROM services')).rows[0].count, before);
    assert.equal((await db.query('SELECT password_hash FROM professionals WHERE id=$1', [owner.id])).rows[0].password_hash, credentials);
    assert.equal((await db.query('SELECT active FROM services WHERE id=$1', [service.id])).rows[0].active, false);
    assert.equal((await db.query('SELECT service_name_snapshot FROM bookings WHERE id=$1', [booking.id])).rows[0].service_name_snapshot, 'Servicio editable');
    assert.equal((await db.query('SELECT count(*) FROM working_hours WHERE professional_id=$1', [other.id])).rows[0].count, '0');
  });
  console.log(`Base aislada de configuración conservada: ${name}`);
});
