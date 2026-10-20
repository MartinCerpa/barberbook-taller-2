import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { DEFAULT_BOOKING_HORIZON_DAYS } from '../src/data/availability.js'
import {
  DEFAULT_RESERVATION_PREFERENCES,
  getRequestExpiresAt,
  getReservationPreferences,
  RESERVATION_PREFERENCES_STORAGE_KEY,
  sanitizeReservationPreferences,
  saveReservationPreferences,
} from '../src/services/reservationPreferencesService.js'

const originalWindow = globalThis.window
let storage
beforeEach(() => {
  storage = new Map()
  globalThis.window = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } })
})
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

test('fallbacks conservan modo manual, sin vencimiento, cancelación 20 y horizonte actual', () => {
  assert.deepEqual(getReservationPreferences(), DEFAULT_RESERVATION_PREFERENCES)
  assert.equal(getReservationPreferences().confirmationMode, 'manual')
  assert.equal(getReservationPreferences().requestExpirationMinutes, null)
  assert.equal(getReservationPreferences().cancellationNoticeMinutes, 20)
  assert.equal(getReservationPreferences().minimumAdvanceMinutes, 0)
  assert.equal(getReservationPreferences().bookingHorizonDays, DEFAULT_BOOKING_HORIZON_DAYS)
})

test('preferencias inválidas usan fallback por campo y no rompen la lectura', () => {
  for (const raw of ['{', 'null', '[]', '{"version":99}', '"incorrecto"']) {
    storage.set(RESERVATION_PREFERENCES_STORAGE_KEY, raw)
    assert.deepEqual(getReservationPreferences(), DEFAULT_RESERVATION_PREFERENCES)
  }
  assert.deepEqual(sanitizeReservationPreferences({
    confirmationMode: 'otro', requestExpirationMinutes: -1,
    cancellationNoticeMinutes: Number.NaN, minimumAdvanceMinutes: 999,
    bookingHorizonDays: 365,
  }), DEFAULT_RESERVATION_PREFERENCES)
})

test('guardado exige una configuración completa válida y utiliza key independiente', () => {
  storage.set('barberbook-taller-2:working-hours:v1', 'no tocar')
  const preferences = { ...DEFAULT_RESERVATION_PREFERENCES,
    confirmationMode: 'automatic', requestExpirationMinutes: 30,
    cancellationNoticeMinutes: 45, minimumAdvanceMinutes: 60, bookingHorizonDays: 30 }
  assert.equal(saveReservationPreferences(preferences).success, true)
  assert.deepEqual(JSON.parse(storage.get(RESERVATION_PREFERENCES_STORAGE_KEY)), preferences)
  assert.equal(storage.get('barberbook-taller-2:working-hours:v1'), 'no tocar')
  for (const invalid of [null, {}, { ...preferences, cancellationNoticeMinutes: -1 },
    { ...preferences, cancellationNoticeMinutes: Number.NaN },
    { ...preferences, confirmationMode: 'otro' }]) {
    assert.equal(saveReservationPreferences(invalid).success, false)
  }
})

test('vencimiento manual se calcula desde timestamp y automático nunca lo crea', () => {
  const createdAt = '2030-01-07T14:00:00.000Z'
  assert.equal(getRequestExpiresAt(createdAt, {
    ...DEFAULT_RESERVATION_PREFERENCES, requestExpirationMinutes: 30,
  }), '2030-01-07T14:30:00.000Z')
  assert.equal(getRequestExpiresAt(createdAt, {
    ...DEFAULT_RESERVATION_PREFERENCES, confirmationMode: 'automatic', requestExpirationMinutes: 30,
  }), null)
  assert.equal(getRequestExpiresAt('inválido'), null)
})

test('fallos de almacenamiento usan fallback y no simulan guardado correcto', () => {
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('Bloqueado') } })
  assert.deepEqual(getReservationPreferences(), DEFAULT_RESERVATION_PREFERENCES)
  assert.equal(saveReservationPreferences(DEFAULT_RESERVATION_PREFERENCES).success, false)
})
