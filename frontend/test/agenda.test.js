import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAgendaItems } from '../src/utils/agendaItems.js';

test('una fecha sin reservas conserva la oferta real recibida del servidor', () => {
  const day = { bookings: [], slots: [{ startsAt: '2026-11-16T13:00:00Z', time: '10:00', services: [{ name: 'Corte', duration: 45, isBookable: true, status: 'available' }] }] };
  const [item] = crearAgendaItems(day);
  assert.equal(item.status, 'available'); assert.deepEqual(item.offeredServices, ['Corte · 45 min']);
  assert.deepEqual(crearAgendaItems({ bookings: [], slots: [] }), []);
});

test('un horario confirmado no reaparece como oferta aunque existan opciones de varios servicios', () => {
  const day = { bookings: [{ id: 1, status: 'confirmed', starts_at: '2026-11-16T13:00:00Z', ends_at: '2026-11-16T14:00:00Z', customer_name: 'Cliente', service_name: 'Corte', customer_phone: '123' }],
    slots: [{ startsAt: '2026-11-16T13:00:00Z', time: '10:00', services: [{ isBookable: false, status: 'confirmed' }] }] };
  const items = crearAgendaItems(day);
  assert.equal(items.length, 1); assert.equal(items[0].status, 'confirmed'); assert.equal(items[0].duration, 60);
});

test('las pendientes reales se agrupan sin duplicar la hora y no desaparecen al cambiar la jornada', () => {
  const b = { id: 1, status: 'pending', starts_at: '2026-11-16T13:00:00Z', ends_at: '2026-11-16T13:30:00Z', customer_name: 'Prueba', customer_phone: '123', service_name: 'Barba' };
  const items = crearAgendaItems({ bookings: [b, { ...b, id: 2 }], slots: [{ startsAt: b.starts_at, time: '10:00', services: [{ isBookable: true, status: 'pending' }] }] });
  assert.equal(items.length, 1); assert.equal(items[0].requestCount, 2); assert.equal(items[0].status, 'pending');
  assert.equal(crearAgendaItems({ bookings: [b], slots: [] }).length, 1);
});
