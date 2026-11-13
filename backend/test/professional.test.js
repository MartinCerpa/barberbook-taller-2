import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import { pool } from '../src/database/connection.js';
import { initializeDatabase } from '../src/database/initialize.js';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword, hashToken, createAuthService } from '../src/services/authService.js';

test('panel profesional: HTTP, sesiones, propiedad, FIFO y concurrencia con PostgreSQL real', { timeout: 90000 }, async (t) => {
  t.after(() => pool.end());
  assert.match(pool.options.database, /^barberbook_t3/);
  const name = `barberbook_t3_auth_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await pool.query(`CREATE DATABASE ${name}`);
  const db = new pg.Pool({ ...pool.options, password: pool.options.password, database: name });
  t.after(() => db.end());
  await initializeDatabase(db, true);
  const app = createApp(db);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const { rows: [matias] } = await db.query('SELECT id FROM professionals ORDER BY id LIMIT 1');
  const { rows: [other] } = await db.query("INSERT INTO professionals(name) VALUES('Profesional Prueba') RETURNING id");
  await db.query('INSERT INTO working_hours SELECT $1,weekday,start_minute,end_minute FROM working_hours WHERE professional_id=$2', [other.id, matias.id]);
  const { rows: [otherService] } = await db.query("INSERT INTO services(professional_id,name,duration_minutes,price) VALUES($1,'Servicio Prueba',30,1000) RETURNING id", [other.id]);
  const services = (await db.query('SELECT * FROM services WHERE professional_id=$1', [matias.id])).rows;
  const beard = services.find((s) => s.name === 'Barba');
  const combo = services.find((s) => s.name === 'Corte + barba');
  const password = randomUUID() + randomUUID();
  const otherPassword = randomUUID() + randomUUID();
  const hash = await hashPassword(password);
  await db.query('UPDATE professionals SET email=$2,password_hash=$3 WHERE id=$1', [matias.id, 'matias@test.invalid', hash]);
  await db.query('UPDATE professionals SET email=$2,password_hash=$3 WHERE id=$1', [other.id, 'other@test.invalid', await hashPassword(otherPassword)]);

  async function request(path, { method = 'GET', body, cookie, csrf, origin } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (csrf) headers['X-CSRF-Token'] = csrf;
    if (origin) headers.Origin = origin;
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  function client(email, secret) {
    return {
      cookie: null, csrf: null,
      async login() {
        const r = await request('/auth/login', { method: 'POST', cookie: this.cookie, body: { email, password: secret } });
        assert.equal(r.status, 200);
        this.cookie = r.cookie.split(';')[0]; this.csrf = r.body.data.csrfToken;
        return r;
      },
      request(path, options = {}) { return request(path, { cookie: this.cookie, csrf: this.csrf, ...options }); },
    };
  }
  const owner = client('matias@test.invalid', password);
  const outsider = client('other@test.invalid', otherPassword);
  const { rows: [clock] } = await db.query("SELECT date_trunc('week',(now() AT TIME ZONE 'America/Santiago')::date+7)::date AS monday");
  async function input(week, time = '10:00', serviceId = beard.id) {
    const { rows: [row] } = await db.query("SELECT ((($1::date+$2::int*7)::text || ' ' || $3)::timestamp AT TIME ZONE 'America/Santiago') AS start", [clock.monday, week, time]);
    return { serviceId, customerName: 'Cliente Prueba Panel', customerPhone: '+56900000097', startsAt: row.start.toISOString() };
  }
  async function create(week, time = '10:00', serviceId = beard.id) {
    const r = await request('/bookings', { method: 'POST', body: await input(week, time, serviceId) });
    assert.equal(r.status, 201); return r.body.data;
  }
  const status = (booking, next, who = owner) => who.request(`/professional/bookings/${booking.id}/status`, { method: 'PATCH', body: { status: next } });
  const mode = (automatic) => owner.request('/professional/settings', { method: 'PATCH', body: { automatic_approval: automatic } });

  await t.test('hash seguro, contraseña incorrecta y correo inexistente sin enumeración', async () => {
    assert.ok(await verifyPassword(password, hash));
    assert.equal(await verifyPassword('incorrecta', hash), false);
    assert.equal(await verifyPassword(password, 'hash-invalido'), false);
    const incorrect = await request('/auth/login', { method: 'POST', body: { email: 'matias@test.invalid', password: 'incorrecta' } });
    const unknown = await request('/auth/login', { method: 'POST', body: { email: 'unknown@test.invalid', password: 'incorrecta' } });
    assert.equal(incorrect.status, 401); assert.equal(unknown.status, 401); assert.equal(incorrect.body.error, unknown.body.error);
    assert.equal((await request('/auth/login', { method: 'POST', origin: 'https://otro-sitio.invalid', body: { email: 'matias@test.invalid', password } })).status, 403);
  });

  await t.test('login, cookie HttpOnly/SameSite y sesión guardada solo mediante hash', async () => {
    const r = await owner.login();
    assert.ok(r.cookie.includes('HttpOnly')); assert.ok(r.cookie.includes('SameSite=Strict')); assert.ok(r.cookie.includes('Path=/api'));
    assert.equal(r.body.data.id, matias.id); assert.equal(Object.hasOwn(r.body.data, 'password_hash'), false);
    const stored = (await db.query('SELECT token_hash,expires_at FROM professional_sessions WHERE professional_id=$1', [matias.id])).rows[0];
    assert.equal(stored.token_hash, hashToken(owner.cookie.split('=')[1]));
    assert.ok(stored.expires_at > new Date());
    assert.equal((await owner.request('/auth/session')).status, 200);
    // Una instancia nueva recupera la sesión desde PostgreSQL, sin depender de memoria.
    assert.equal((await createAuthService(db).session(owner.cookie.split('=')[1])).id, matias.id);
    await outsider.login();
  });

  await t.test('privados sin sesión o CSRF se rechazan y catálogos públicos no revelan credenciales', async () => {
    assert.equal((await request('/professional/bookings')).status, 401);
    assert.equal((await request('/professional/settings', { method: 'PATCH', body: { automatic_approval: true } })).status, 401);
    assert.equal((await request('/professional/settings', { method: 'PATCH', cookie: owner.cookie, body: { automatic_approval: true } })).status, 403);
    assert.equal((await owner.request('/professional/settings', { method: 'PATCH', csrf: 'invalido', body: { automatic_approval: true } })).status, 403);
    assert.equal((await owner.request('/auth/logout', { method: 'POST', csrf: 'invalido', body: {} })).status, 403);
    const publicData = JSON.stringify((await request('/professionals')).body);
    assert.equal(publicData.includes('password_hash'), false); assert.equal(publicData.includes('@test.invalid'), false);
  });

  await t.test('aislamiento de listados, confirmación, rechazo y configuración entre profesionales', async () => {
    const own = await create(0, '15:00'); const foreign = await create(0, '16:00', otherService.id);
    const mine = (await owner.request('/professional/bookings?status=pending')).body.data;
    assert.ok(mine.some((r) => r.id === own.id)); assert.equal(mine.some((r) => r.id === foreign.id), false);
    assert.equal((await status(foreign, 'confirmed')).status, 404); assert.equal((await status(foreign, 'rejected')).status, 404);
    assert.equal((await outsider.request('/professional/bookings')).body.data.some((r) => r.id === own.id), false);
    assert.equal((await owner.request(`/professional/bookings?professionalId=${other.id}`)).status, 400);
    assert.equal((await owner.request('/professional/settings', { method: 'PATCH', body: { automatic_approval: true, professionalId: other.id } })).status, 400);
    assert.equal((await owner.request('/professional/settings', { method: 'PATCH', body: { automatic_approval: 'false' } })).status, 400);
    assert.equal((await owner.request('/professional/bookings?status=desconocido')).status, 400);
  });

  await t.test('FIFO cronológico con empate por ID, confirmación, rechazo e idempotencia', async () => {
    const a = await create(1); const b = await create(1);
    await db.query('UPDATE bookings SET created_at=(SELECT created_at FROM bookings WHERE id=$1) WHERE id=$2', [a.id, b.id]);
    const listed = (await owner.request('/professional/bookings?status=pending')).body.data.map((r) => r.id);
    assert.ok(listed.indexOf(a.id) < listed.indexOf(b.id));
    const blocked = await status(b, 'confirmed'); assert.equal(blocked.status, 409); assert.ok(blocked.body.error.includes('FIFO'));
    assert.equal((await status(a, 'confirmed')).status, 200);
    assert.equal((await status(a, 'confirmed')).status, 200);
    assert.equal((await status(b, 'confirmed')).status, 409);
    assert.equal((await status(b, 'rejected')).status, 200);
    assert.equal((await status(b, 'confirmed')).status, 409);
    assert.equal((await status(a, 'rejected')).status, 409);
    assert.equal((await status(a, 'cancelled')).status, 400);
  });

  await t.test('rechazar la primera solicitud permite confirmar la siguiente elegible', async () => {
    const a = await create(2); const b = await create(2);
    assert.equal((await status(b, 'confirmed')).status, 409);
    assert.equal((await status(a, 'rejected')).status, 200);
    assert.equal((await status(b, 'confirmed')).status, 200);
  });

  await t.test('FIFO solo entre intervalos solapados; servicios distintos compiten por el profesional', async () => {
    const a = await create(3, '10:00', combo.id); const b = await create(3);
    assert.equal((await status(b, 'confirmed')).status, 409);
    const adjacent = await create(3, '11:00');
    assert.equal((await status(adjacent, 'confirmed')).status, 200);
    assert.equal((await status(a, 'confirmed')).status, 200);
  });

  await t.test('una anterior que ya no cabe en jornada no bloquea otra elegible', async () => {
    const a = await create(4, '10:00', combo.id); const b = await create(4);
    await db.query('UPDATE working_hours SET end_minute=630 WHERE professional_id=$1 AND weekday=1 AND start_minute=600', [matias.id]);
    try {
      assert.equal((await status(a, 'confirmed')).status, 422);
      assert.equal((await status(b, 'confirmed')).status, 200);
    } finally { await db.query('UPDATE working_hours SET end_minute=780 WHERE professional_id=$1 AND weekday=1 AND start_minute=600', [matias.id]); }
  });

  await t.test('confirmar revalida jornada, futuro y duración histórica de la reserva', async () => {
    const late = await create(5, '18:00', combo.id);
    await db.query('UPDATE working_hours SET end_minute=1110 WHERE professional_id=$1 AND weekday=1 AND start_minute=900', [matias.id]);
    try { assert.equal((await status(late, 'confirmed')).status, 422); }
    finally { await db.query('UPDATE working_hours SET end_minute=1140 WHERE professional_id=$1 AND weekday=1 AND start_minute=900', [matias.id]); }
    const old = await create(5, '12:00');
    await db.query("UPDATE bookings SET starts_at='2000-01-03T13:00:00Z',ends_at='2000-01-03T13:30:00Z' WHERE id=$1", [old.id]);
    assert.equal((await status(old, 'confirmed')).status, 422);
    const snapshot = await create(5, '11:00');
    await db.query('UPDATE services SET duration_minutes=60 WHERE id=$1', [beard.id]);
    try {
      const r = await status(snapshot, 'confirmed'); assert.equal(r.status, 200);
      assert.equal(new Date(r.body.data.ends_at) - new Date(r.body.data.starts_at), 30 * 60000);
    } finally { await db.query('UPDATE services SET duration_minutes=30 WHERE id=$1', [beard.id]); }
  });

  await t.test('confirmaciones concurrentes y creaciones automáticas no se superponen', async () => {
    const a = await create(6); const b = await create(6);
    const responses = await Promise.all([status(a, 'confirmed'), status(b, 'confirmed')]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await mode(true)).status, 200);
    const body = await input(7);
    const creations = await Promise.all([request('/bookings', { method: 'POST', body }), request('/bookings', { method: 'POST', body })]);
    assert.deepEqual(creations.map((r) => r.status).sort(), [201, 409]);
    assert.equal(creations.find((r) => r.status === 201).body.data.status, 'confirmed');
    await mode(false);
  });

  await t.test('modo automático no procesa pendientes previas ni permite saltar FIFO', async () => {
    const a = await create(8);
    assert.equal((await mode(true)).status, 200);
    assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1', [a.id])).rows[0].status, 'pending');
    const b = await create(8); assert.equal(b.status, 'pending');
    const free = await create(8, '11:00'); assert.equal(free.status, 'confirmed');
    assert.equal((await status(b, 'confirmed')).status, 409);
    await mode(false); const manual = await create(8, '12:00'); assert.equal(manual.status, 'pending');
    assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1', [free.id])).rows[0].status, 'confirmed');
    await status(a, 'rejected'); assert.equal((await status(b, 'confirmed')).status, 200);
  });

  await t.test('FIFO conserva precisión PostgreSQL por debajo de un milisegundo', async () => {
    const a = await create(9); const b = await create(9);
    await db.query("UPDATE bookings SET created_at=CASE WHEN id=$1 THEN '2026-11-13T10:00:00.123456Z'::timestamptz ELSE '2026-11-13T10:00:00.123789Z'::timestamptz END WHERE id IN ($1,$2)", [a.id, b.id]);
    assert.equal((await status(b, 'confirmed')).status, 409);
    assert.equal((await status(a, 'confirmed')).status, 200);
  });

  await t.test('rotación, expiración y logout invalidan la sesión SQL', async () => {
    const previous = owner.cookie;
    await owner.login(); assert.ok(owner.cookie !== previous);
    assert.equal((await request('/auth/session', { cookie: previous })).status, 401);
    const cookie = owner.cookie;
    assert.equal((await owner.request('/auth/logout', { method: 'POST', body: {} })).status, 200);
    assert.equal((await request('/auth/session', { cookie })).status, 401);
    await owner.login();
    await db.query("UPDATE professional_sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1", [hashToken(owner.cookie.split('=')[1])]);
    assert.equal((await owner.request('/auth/session')).status, 401);
  });

  await t.test('login limita intentos fallidos sin emitir sesiones', async () => {
    for (let i = 0; i < 10; i++) {
      assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'matias@test.invalid', password: 'incorrecta' } })).status, 401);
    }
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'matias@test.invalid', password } })).status, 429);
  });
  console.log('Base aislada de pruebas profesionales conservada:', name);
});
