import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchHolidays, normalizeHolidays, HOLIDAY_API } from '../src/services/holidayService.js'

// Fixtures exclusivos de tests: nunca forman parte del calendario de la aplicación.
const holiday = {
  date: '2026-10-31', name: 'Reformation Day', countryCode: 'CL',
  nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'],
}

test('fetch real usa endpoint v4 por año y no envía credenciales', async () => {
  let request
  const rows = await fetchHolidays(2026, { fetcher: async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => [holiday] }
  } })
  assert.equal(request.url, `${HOLIDAY_API}/2026`)
  assert.equal(request.options.credentials, 'omit')
  assert.ok(request.options.signal instanceof AbortSignal)
  assert.deepEqual(rows, [{ date: holiday.date, name: holiday.name }])
})

test('filtra regionales y tipos no públicos, ordena y elimina duplicados', () => {
  const rows = normalizeHolidays([
    holiday, holiday,
    { ...holiday, date: '2026-01-01', name: 'New Year' },
    { ...holiday, date: '2026-06-07', nationalHoliday: false },
    { ...holiday, date: '2026-06-08', holidayTypes: ['Bank'] },
  ], 2026)
  assert.deepEqual(rows.map((row) => row.date), ['2026-01-01', '2026-10-31'])
})

test('respuesta vacía es válida y no inventa feriados', () => {
  assert.deepEqual(normalizeHolidays([], 2026), [])
})

test('rechaza fechas imposibles, país, año y tipos incorrectos', () => {
  for (const invalid of [
    null, { data: [] }, [{ ...holiday, date: '2026-02-30' }],
    [{ ...holiday, date: '2027-10-31' }], [{ ...holiday, countryCode: 'AR' }],
    [{ ...holiday, name: '' }], [{ ...holiday, nationalHoliday: 'true' }],
    [{ ...holiday, holidayTypes: null }],
  ]) assert.throws(() => normalizeHolidays(invalid, 2026))
})

test('propaga error HTTP, red y JSON para que React ofrezca reintentar', async () => {
  for (const fetcher of [
    async () => ({ ok: false, status: 503 }),
    async () => { throw new Error('network') },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('json') } }),
  ]) await assert.rejects(fetchHolidays(2026, { fetcher }))
})

test('un reintento después de un fallo obtiene datos y no conserva error', async () => {
  await assert.rejects(fetchHolidays(2026, { fetcher: async () => ({ ok: false }) }))
  assert.equal((await fetchHolidays(2026, {
    fetcher: async () => ({ ok: true, json: async () => [holiday] }),
  })).length, 1)
})

test('valida año antes de consultar y soporta cancelación al desmontar', async () => {
  await assert.rejects(fetchHolidays(NaN))
  await assert.rejects(fetchHolidays(1800))
  const controller = new AbortController()
  controller.abort()
  await fetchHolidays(2026, { signal: controller.signal, fetcher: async (_url, options) => {
    assert.equal(options.signal.aborted, true)
    return { ok: true, json: async () => [] }
  } })
})
