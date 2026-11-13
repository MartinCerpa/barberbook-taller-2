import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptarReserva, fechaChile, resumirJornada } from '../src/utils/panelData.js';

test('la jornada usa la fecha chilena aunque UTC ya esté en el día siguiente', () => {
  assert.equal(fechaChile('2026-11-14T01:30:00Z'), '2026-11-13');
  assert.equal(fechaChile('2026-07-14T03:30:00Z'), '2026-07-13');
});

test('las tarjetas muestran duración persistida y hora chilena, no la del catálogo', () => {
  const result = adaptarReserva({ id: 1, starts_at: '2026-11-14T13:00:00Z', ends_at: '2026-11-14T13:45:00Z', customer_name: 'Prueba', customer_phone: '123', service_name: 'Corte', status: 'confirmed' });
  assert.equal(result.time, '10:00');
  assert.equal(result.endTime, '10:45');
  assert.equal(result.duration, 45);
});

test('el resumen distingue pendientes, confirmadas de hoy y próxima futura sin inventar ingresos', () => {
  const confirmed = [{ starts_at: '2026-11-15T13:00:00Z' }, { starts_at: '2026-11-13T18:00:00Z' }, { starts_at: '2026-11-13T13:00:00Z' }];
  const snapshot = JSON.stringify(confirmed);
  const summary = resumirJornada([{}, {}], confirmed, new Date('2026-11-13T14:00:00Z'));
  assert.equal(summary.pendingCount, 2);
  assert.equal(summary.confirmedToday, 2);
  assert.equal(summary.next.starts_at, '2026-11-13T18:00:00Z');
  assert.equal(summary.revenue, undefined);
  assert.equal(JSON.stringify(confirmed), snapshot);
});

test('sin registros no se fabrica una próxima atención', () => {
  const summary = resumirJornada([], [], new Date('2026-11-13T14:00:00Z'));
  assert.equal(summary.next, undefined);
  assert.equal(summary.confirmedToday, 0);
});
