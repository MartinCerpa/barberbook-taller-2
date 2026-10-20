import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getCurrentPendingRequests,
  getDailyClientCount,
  getDailyOperationsSummary,
  getNextConfirmedAppointment,
} from '../src/services/bookingInsightsService.js'

const dateId = '2030-01-07'
const appointment = (overrides = {}) => ({
  id: 'booking-a',
  appointmentId: 'appointment-booking-a',
  customerId: 'customer-a',
  customerName: 'Cliente A',
  service: 'Corte de cabello',
  dateId,
  time: '10:00',
  status: 'confirmed',
  ...overrides,
})

test('solicitudes pendientes vigentes reutilizan la regla y el orden actuales', () => {
  const context = { currentDayOrder: 2, currentTime: '10:00' }
  const requests = [
    { id: 'future-later', status: 'pending', dayOrder: 3, time: '12:00' },
    { id: 'rejected', status: 'rejected', dayOrder: 3, time: '09:00' },
    { id: 'today-future', status: 'pending', dayOrder: 2, time: '10:30' },
    { id: 'today-past', status: 'pending', dayOrder: 2, time: '10:00' },
    { id: 'future-earlier', status: 'pending', dayOrder: 3, time: '09:00' },
  ]

  assert.deepEqual(
    getCurrentPendingRequests(requests, context).map((request) => request.id),
    ['today-future', 'future-earlier', 'future-later'],
  )
})

test('próxima atención usa solo confirmadas con atención y orden date/time/id', () => {
  const now = new Date(`${dateId}T10:00:00`)
  const appointments = [
    appointment({ id: 'z-last-tie', time: '11:00' }),
    appointment({ id: 'ignored-completed', time: '10:30', status: 'completed' }),
    appointment({ id: 'ignored-without-appointment', time: '10:15', appointmentId: null }),
    appointment({ id: 'past', time: '09:59' }),
    appointment({ id: 'b-tie', time: '10:00' }),
    appointment({ id: 'a-tie', time: '10:00' }),
    appointment({ id: 'tomorrow', dateId: '2030-01-08', time: '09:00' }),
  ]

  assert.equal(getNextConfirmedAppointment(appointments, now)?.id, 'a-tie')
  assert.equal(
    getNextConfirmedAppointment(appointments, new Date('2030-01-09T09:00:00')),
    null,
  )
})

test('clientes del día son únicos y solo consideran confirmadas o completadas', () => {
  const appointments = [
    appointment({ id: 'confirmed-a' }),
    appointment({ id: 'completed-a', time: '11:00', status: 'completed' }),
    appointment({ id: 'completed-b', customerId: 'customer-b', time: '12:00', status: 'completed' }),
    appointment({ id: 'pending-c', customerId: 'customer-c', time: '13:00', status: 'pending' }),
    appointment({ id: 'cancelled-d', customerId: 'customer-d', time: '14:00', status: 'cancelled' }),
    appointment({ id: 'no-show-e', customerId: 'customer-e', time: '15:00', status: 'no_show' }),
    appointment({ id: 'other-day', customerId: 'customer-f', dateId: '2030-01-08' }),
    appointment({ id: 'missing-customer', customerId: '', time: '16:00' }),
  ]

  assert.equal(getDailyClientCount(appointments, dateId), 2)
})

test('resumen diario refleja una confirmada que luego se completa', () => {
  const now = new Date(`${dateId}T09:00:00`)
  const confirmed = appointment()
  const before = getDailyOperationsSummary([confirmed], dateId, now)

  assert.deepEqual(before, {
    dateId,
    totalAppointments: 1,
    completedAppointments: 0,
    confirmedAppointments: 1,
    clientsToday: 1,
    nextAppointment: confirmed,
  })

  const completed = { ...confirmed, status: 'completed' }
  const after = getDailyOperationsSummary([completed], dateId, now)

  assert.deepEqual(after, {
    dateId,
    totalAppointments: 1,
    completedAppointments: 1,
    confirmedAppointments: 0,
    clientsToday: 1,
    nextAppointment: null,
  })
})

test('resumen diario ignora otros estados y fechas y conserva clientes únicos', () => {
  const now = new Date(`${dateId}T09:00:00`)
  const first = appointment({ id: 'first', time: '10:00' })
  const summary = getDailyOperationsSummary([
    first,
    appointment({ id: 'same-client-completed', time: '11:00', status: 'completed' }),
    appointment({ id: 'second-client', customerId: 'customer-b', time: '12:00' }),
    appointment({ id: 'pending', customerId: 'customer-c', time: '13:00', status: 'pending' }),
    appointment({ id: 'other-day', customerId: 'customer-d', dateId: '2030-01-08' }),
  ], dateId, now)

  assert.equal(summary.totalAppointments, 3)
  assert.equal(summary.confirmedAppointments, 2)
  assert.equal(summary.completedAppointments, 1)
  assert.equal(summary.clientsToday, 2)
  assert.equal(summary.nextAppointment, first)
})

test('resumen diario vacío entrega ceros y no inventa próxima atención', () => {
  assert.deepEqual(
    getDailyOperationsSummary([], dateId, new Date(`${dateId}T09:00:00`)),
    {
      dateId,
      totalAppointments: 0,
      completedAppointments: 0,
      confirmedAppointments: 0,
      clientsToday: 0,
      nextAppointment: null,
    },
  )
})
