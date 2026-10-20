import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { getDefaultWeeklyHours } from '../src/data/availability.js'
import {
  AVAILABILITY_CHANGE_EVENT,
  BLOCKED_SLOTS_STORAGE_KEY,
  ENABLED_SLOTS_STORAGE_KEY,
  getBlockedSlots,
  getEnabledSlots,
  saveBlockedSlots,
} from '../src/services/availabilityPreferencesService.js'
import {
  getWorkingHours,
  sanitizeWorkingHours,
  saveWorkingHours,
  WORKING_HOURS_STORAGE_KEY,
} from '../src/services/workingHoursPreferencesService.js'
import {
  blockTimeSlot,
  enableTimeSlot,
  getAvailabilityRequestsForDate,
  getBookingDates,
  getEffectiveTimeSlotsForDate,
  restoreTimeSlot,
  subscribeAvailability,
  unblockTimeSlot,
} from '../src/services/availabilityService.js'

// Solo almacenamiento en memoria: nunca toca preferencias reales del navegador.
const originalWindow = globalThis.window
let storage
beforeEach(() => {
  storage = new Map()
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  })
})
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

const monday = '2030-01-07'
const nextMonday = '2030-01-14'
const sunday = '2030-01-13'
const slot = (date, time, requests = []) =>
  getEffectiveTimeSlotsForDate(date, requests).find((item) => item.time === time)
const changeDay = (day, update) => {
  const hours = getWorkingHours()
  Object.assign(hours.days.find((item) => item.day === day), update)
  return saveWorkingHours(hours)
}

test('defaults conservan las horas y pausas del mock', () => {
  const hours = getWorkingHours()
  assert.deepEqual(hours, getDefaultWeeklyHours())
  assert.deepEqual(hours.days[0].intervals, [
    { start: '10:00', end: '13:00' }, { start: '15:00', end: '19:00' },
  ])
  assert.deepEqual(hours.days[5].intervals, [
    { start: '10:00', end: '14:00' }, { start: '15:00', end: '16:00' },
  ])
  assert.deepEqual(hours.days[6], { day: 0, enabled: false, intervals: [] })
  assert.equal(slot(monday, '13:00').status, 'unavailable')
  assert.equal(slot(monday, '15:00').status, 'available')
  assert.equal(getEffectiveTimeSlotsForDate(sunday, []).some((item) => item.isBookable), false)
})

test('lectura defensiva: JSON corrupto, tipos inválidos y versiones desconocidas', () => {
  for (const value of ['{', 'null', 'false', '[]', '{"version":99,"days":[]}']) {
    storage.set(WORKING_HOURS_STORAGE_KEY, value)
    assert.deepEqual(getWorkingHours(), getDefaultWeeklyHours())
  }
  const partial = { days: [{ day: 1, enabled: false, intervals: [] }] }
  assert.equal(sanitizeWorkingHours(partial).days[0].enabled, false)
  assert.deepEqual(sanitizeWorkingHours(partial).days[1], getDefaultWeeklyHours().days[1])
  assert.equal(sanitizeWorkingHours(partial.days).days[0].enabled, false)
  partial.days.push(partial.days[0])
  assert.deepEqual(sanitizeWorkingHours(partial), getDefaultWeeklyHours())
})

test('guarda una semana completa, ordena intervalos y conserva otras preferencias', () => {
  storage.set('barberbook-taller-2:profile:v1', 'preferencia existente')
  saveBlockedSlots([{ date: monday, time: '15:00' }])
  assert.equal(changeDay(1, { intervals: [
    { start: '15:00', end: '19:00' }, { start: '09:00', end: '13:00' },
  ] }).success, true)
  assert.equal(getWorkingHours().days[0].intervals[0].start, '09:00')
  assert.equal(JSON.parse(storage.get(WORKING_HOURS_STORAGE_KEY)).version, 1)
  assert.equal(storage.get('barberbook-taller-2:profile:v1'), 'preferencia existente')
  assert.deepEqual(getBlockedSlots(), [{ date: monday, time: '15:00' }])
  assert.equal(slot(monday, '09:00').isBookable, true)
  assert.equal(slot(monday, '13:00').isBookable, false)
})

test('rechaza intervalos vacíos, cruzados, invertidos, inválidos o excesivos sin guardar', () => {
  for (const intervals of [[], [{ start: '15:00', end: '10:00' }],
    [{ start: '10:00', end: '10:00' }], [{ start: '', end: '13:00' }],
    [{ start: '25:00', end: '26:00' }],
    [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '15:00' }],
    Array.from({ length: 5 }, () => ({ start: '10:00', end: '13:00' })),
  ]) {
    assert.equal(changeDay(1, { intervals }).success, false)
    assert.equal(storage.has(WORKING_HOURS_STORAGE_KEY), false)
  }
  for (const value of [null, {}, { days: [] }, { days: [...getWorkingHours().days, { day: 7 }] }]) {
    assert.equal(saveWorkingHours(value).success, false)
  }
})

test('intervalos con minutos mantienen cadencia horaria y término exclusivo', () => {
  changeDay(1, { intervals: [{ start: '09:30', end: '12:30' }] })
  const offered = getEffectiveTimeSlotsForDate(monday, []).filter((item) => item.isBookable)
  assert.deepEqual(offered.map((item) => item.time), ['09:30', '10:30', '11:30'])
})

test('cierra y activa días sin borrar reservas confirmadas', () => {
  assert.equal(changeDay(1, { enabled: false }).success, true)
  assert.equal(slot(monday, '10:00').status, 'unavailable')
  assert.equal(slot(monday, '12:00').status, 'confirmed')
  assert.equal(slot(monday, '12:00').isBookable, false)
  assert.equal(slot(monday, '12:00').action, null)
  assert.equal(changeDay(1, { enabled: true }).success, true)
  assert.equal(slot(monday, '10:00').isBookable, true)
  assert.equal(changeDay(0, { enabled: true, intervals: [{ start: '09:00', end: '11:00' }] }).success, true)
  assert.equal(slot(sunday, '09:00').isBookable, true)
})

test('un día cerrado no queda bloqueado por un intervalo incompleto oculto', () => {
  assert.equal(changeDay(1, { enabled: false, intervals: [{ start: '', end: '' }] }).success, true)
  assert.deepEqual(getWorkingHours().days[0], { day: 1, enabled: false, intervals: [] })
})

test('bloqueos existentes se conservan, deduplican y afectan solo fecha + hora', () => {
  storage.set(BLOCKED_SLOTS_STORAGE_KEY, JSON.stringify([
    { date: monday, time: '15:00' }, { date: monday, time: '15:00' },
    { date: '2030-02-30', time: '15:00' }, { date: monday, time: '25:00' }, null,
  ]))
  assert.equal(getBlockedSlots().length, 1)
  assert.equal(slot(monday, '15:00').status, 'blocked')
  assert.equal(slot(monday, '15:00').action, 'unblock')
  assert.equal(slot(nextMonday, '15:00').status, 'available')
  assert.equal(blockTimeSlot(monday, '15:00', []).changed, false)
  assert.equal(blockTimeSlot(monday, '17:00', []).success, true)
  assert.equal(unblockTimeSlot(monday, '15:00').success, true)
  assert.equal(slot(monday, '15:00').isBookable, true)
  changeDay(1, { enabled: false })
  assert.equal(unblockTimeSlot(monday, '17:00').success, true)
  assert.equal(slot(monday, '17:00').status, 'unavailable')
  assert.equal(slot(monday, '17:00').action, 'enable')
})

test('habilitación excepcional y restauración no modifican horario ni otras fechas', () => {
  const hours = getWorkingHours()
  assert.equal(enableTimeSlot(monday, '13:00', []).success, true)
  assert.deepEqual(getEnabledSlots(), [{ date: monday, time: '13:00' }])
  assert.equal(slot(monday, '13:00').status, 'available')
  assert.equal(slot(monday, '13:00').action, 'restore')
  assert.equal(slot(nextMonday, '13:00').status, 'unavailable')
  assert.equal(slot('2030-01-08', '13:00').status, 'unavailable')
  assert.deepEqual(getWorkingHours(), hours)
  assert.equal(blockTimeSlot(monday, '13:00', []).success, false)
  assert.equal(restoreTimeSlot(monday, '13:00').success, true)
  assert.equal(slot(monday, '13:00').status, 'unavailable')
  assert.equal(storage.has(ENABLED_SLOTS_STORAGE_KEY), false)
  assert.equal(enableTimeSlot(sunday, '13:00', []).success, true)
  assert.equal(slot(sunday, '13:00').isBookable, true)
})

test('reservas y solicitudes prioritarias; una solicitud no abre un día cerrado', () => {
  const pending = [{ time: '15:00', status: 'pending' }]
  const confirmed = [{ time: '15:00', status: 'confirmed', customerName: 'Cliente de prueba' }]
  saveBlockedSlots([{ date: monday, time: '15:00' }, { date: monday, time: '12:00' }])
  assert.equal(slot(monday, '15:00', pending).status, 'pending')
  assert.equal(slot(monday, '15:00', pending).isBookable, true)
  assert.equal(slot(monday, '15:00', confirmed).status, 'confirmed')
  assert.equal(slot(monday, '15:00', confirmed).customerName, 'Cliente de prueba')
  assert.equal(slot(monday, '15:00', [...pending, ...confirmed]).isBookable, false)
  assert.equal(blockTimeSlot(monday, '15:00', pending).success, false)
  assert.equal(enableTimeSlot(monday, '12:00', []).success, false)
  changeDay(1, { enabled: false })
  assert.equal(slot(monday, '15:00', pending).status, 'pending')
  assert.equal(slot(monday, '15:00', pending).isBookable, false)
  assert.equal(slot(monday, '15:00', confirmed).status, 'confirmed')
})

test('fechas públicas y Agenda consumen el mismo resultado efectivo', () => {
  for (const date of getBookingDates()) {
    const implicit = getEffectiveTimeSlotsForDate(date.id)
    const explicit = getEffectiveTimeSlotsForDate(date.id, getAvailabilityRequestsForDate(date.id))
    assert.deepEqual(implicit, explicit)
    assert.equal(date.available, explicit.some((item) => item.isBookable))
  }
  const closedSunday = getBookingDates().find((date) => new Date(date.id + 'T12:00:00').getDay() === 0)
  assert.equal(closedSunday.available, false)
  enableTimeSlot(closedSunday.id, '13:00', [])
  assert.equal(getBookingDates().find((date) => date.id === closedSunday.id).available, true)
  restoreTimeSlot(closedSunday.id, '13:00')
  assert.equal(getBookingDates().find((date) => date.id === closedSunday.id).available, false)
})

test('storage corrupto o inaccesible no rompe el flujo y reporta error de guardado', () => {
  storage.set(BLOCKED_SLOTS_STORAGE_KEY, '{')
  storage.set(ENABLED_SLOTS_STORAGE_KEY, '{}')
  assert.deepEqual(getBlockedSlots(), [])
  assert.deepEqual(getEnabledSlots(), [])
  window.localStorage.setItem = () => { throw new Error('Sin espacio') }
  window.localStorage.removeItem = () => { throw new Error('Sin permiso') }
  assert.equal(saveWorkingHours(getWorkingHours()).success, false)
  assert.equal(blockTimeSlot(monday, '15:00', []).success, false)
  assert.equal(enableTimeSlot(monday, '13:00', []).success, false)
  assert.equal(restoreTimeSlot(monday, '13:00').success, false)
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('Deshabilitado') } })
  assert.deepEqual(getWorkingHours(), getDefaultWeeklyHours())
  assert.equal(getEffectiveTimeSlotsForDate(monday, []).length > 0, true)
  assert.equal(saveWorkingHours(getWorkingHours()).success, false)
  assert.equal(getEffectiveTimeSlotsForDate('fecha inválida').length, 0)
})

test('notifica cambios locales y entre pestañas; cancela suscripciones al salir', () => {
  let changes = 0
  const unsubscribe = subscribeAvailability(() => { changes += 1 })
  saveWorkingHours(getWorkingHours())
  enableTimeSlot(monday, '13:00', [])
  blockTimeSlot(monday, '15:00', [])
  assert.equal(changes, 3)
  const storageEvent = (key) => Object.assign(new Event('storage'), { key })
  window.dispatchEvent(storageEvent(WORKING_HOURS_STORAGE_KEY))
  window.dispatchEvent(storageEvent('otra-preferencia'))
  assert.equal(changes, 4)
  unsubscribe()
  window.dispatchEvent(new Event(AVAILABILITY_CHANGE_EVENT))
  assert.equal(changes, 4)
})
