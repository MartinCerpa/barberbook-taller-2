import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateFinancialSummary, getFinancialPeriodRange,
} from '../src/services/financialService.js'

const referenceDate = new Date(2025, 0, 1, 16, 30)
const appointment = (overrides = {}) => ({
  id: 'record-default',
  appointmentId: 'appointment-record-default',
  customerId: 'customer-default',
  serviceId: 'haircut',
  service: 'Corte de cabello',
  dateId: '2025-01-01',
  time: '10:00',
  status: 'completed',
  price: 12000,
  ...overrides,
})

test('solo las atenciones completadas generan ingresos realizados', () => {
  const statuses = ['pending', 'confirmed', 'rejected', 'expired', 'cancelled', 'no_show']
  const records = statuses.map((status, index) => appointment({
    id: `record-${status}`,
    status,
    price: 1000 * (index + 1),
  }))
  const summary = calculateFinancialSummary(records, 'today', referenceDate)

  assert.equal(summary.realizedIncome, 0)
  assert.equal(summary.completedServices, 0)
  assert.equal(summary.confirmedBookings, 1)
  assert.equal(summary.averageTicket, 0)
  assert.equal(summary.topService, null)
  assert.equal(summary.attendedClients, 0)
})

test('estado vacío devuelve métricas en cero sin inventar actividad', () => {
  assert.deepEqual(calculateFinancialSummary([], 'today', referenceDate), {
    period: { id: 'today', label: 'Hoy', startDateId: '2025-01-01', endDateId: '2025-01-01' },
    realizedIncome: 0,
    completedServices: 0,
    confirmedBookings: 0,
    averageTicket: 0,
    topService: null,
    attendedClients: 0,
  })
})

test('calcula ticket promedio y clientes únicos sobre atenciones completadas', () => {
  const records = [
    appointment({ id: 'one', customerId: 'client-a', price: 10000 }),
    appointment({ id: 'two', customerId: 'client-a', price: 14000 }),
    appointment({ id: 'three', customerId: 'client-b', price: 12000 }),
    appointment({ id: 'confirmed', customerId: 'client-c', status: 'confirmed', price: 50000 }),
  ]
  const summary = calculateFinancialSummary(records, 'today', referenceDate)

  assert.equal(summary.realizedIncome, 36000)
  assert.equal(summary.completedServices, 3)
  assert.equal(summary.confirmedBookings, 1)
  assert.equal(summary.averageTicket, 12000)
  assert.equal(summary.attendedClients, 2)
})

test('el servicio principal resuelve empates por nombre alfabético de forma estable', () => {
  const records = [
    appointment({ id: 'cut-one', serviceId: 'cut', service: 'Corte', customerId: 'one' }),
    appointment({ id: 'beard-one', serviceId: 'beard', service: 'Barba', customerId: 'two' }),
    appointment({ id: 'cut-two', serviceId: 'cut', service: 'Corte', customerId: 'three' }),
    appointment({ id: 'beard-two', serviceId: 'beard', service: 'Barba', customerId: 'four' }),
  ]

  assert.deepEqual(calculateFinancialSummary(records, 'today', referenceDate).topService, {
    id: 'beard', name: 'Barba', count: 2,
  })
})

test('hoy usa la fecha local inyectada y no incluye días vecinos', () => {
  const records = [
    appointment({ id: 'previous', dateId: '2024-12-31', price: 1000 }),
    appointment({ id: 'today', dateId: '2025-01-01', price: 2000 }),
    appointment({ id: 'next', dateId: '2025-01-02', price: 4000 }),
  ]

  assert.equal(calculateFinancialSummary(records, 'today', referenceDate).realizedIncome, 2000)
})

test('semana local comienza lunes, termina domingo y soporta cambio de año', () => {
  assert.deepEqual(getFinancialPeriodRange('week', referenceDate), {
    id: 'week', label: 'Esta semana', startDateId: '2024-12-30', endDateId: '2025-01-05',
  })
  const records = [
    appointment({ id: 'before', dateId: '2024-12-29', price: 1 }),
    appointment({ id: 'monday', dateId: '2024-12-30', price: 1000 }),
    appointment({ id: 'sunday', dateId: '2025-01-05', price: 2000 }),
    appointment({ id: 'after', dateId: '2025-01-06', price: 4 }),
  ]

  assert.equal(calculateFinancialSummary(records, 'week', referenceDate).realizedIncome, 3000)
})

test('mes calendario respeta sus límites locales incluso en año bisiesto', () => {
  const leapReference = new Date(2024, 1, 15, 23, 45)
  assert.deepEqual(getFinancialPeriodRange('month', leapReference), {
    id: 'month', label: 'Este mes', startDateId: '2024-02-01', endDateId: '2024-02-29',
  })
  const records = [
    appointment({ id: 'january', dateId: '2024-01-31', price: 1 }),
    appointment({ id: 'first', dateId: '2024-02-01', price: 1000 }),
    appointment({ id: 'last', dateId: '2024-02-29', price: 2000 }),
    appointment({ id: 'march', dateId: '2024-03-01', price: 4 }),
  ]

  assert.equal(calculateFinancialSummary(records, 'month', leapReference).realizedIncome, 3000)
})

test('usa el precio histórico del registro y no valores actuales del catálogo', () => {
  const record = appointment({ price: 12500, currentServicePrice: 18000 })
  const original = structuredClone(record)
  const summary = calculateFinancialSummary([record], 'today', referenceDate)

  assert.equal(summary.realizedIncome, 12500)
  assert.equal(summary.averageTicket, 12500)
  assert.deepEqual(record, original)
})

test('una reserva confirmada solo pasa a ingresos al quedar completada', () => {
  const confirmed = appointment({ status: 'confirmed', price: 15000 })
  const before = calculateFinancialSummary([confirmed], 'today', referenceDate)
  const after = calculateFinancialSummary([{ ...confirmed, status: 'completed' }], 'today', referenceDate)

  assert.equal(before.realizedIncome, 0)
  assert.equal(before.confirmedBookings, 1)
  assert.equal(after.realizedIncome, 15000)
  assert.equal(after.confirmedBookings, 0)
  assert.equal(after.completedServices, 1)
})
