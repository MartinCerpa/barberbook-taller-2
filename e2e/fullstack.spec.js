import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { formatRequestDateId } from '../src/utils/requestUtils.js'
import { formatCurrency } from '../src/utils/formatters.js'
const access = async () =>
  JSON.parse(await fs.readFile('.runtime/e2e-access.json', 'utf8'))
async function login(page, path = '/#/panel/dashboard') {
  await page.goto(path)
  const credentials = await access()
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(credentials.email)
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill(credentials.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cerrar sesión', exact: true }),
  ).toBeVisible()
}
const datePattern = (date) =>
  new RegExp(
    '^' + formatRequestDateId(date).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
test.describe.configure({ mode: 'serial' })

test('reserva pública sin cuenta, login, confirmación, agenda y aislamiento de navegación', async ({
  page,
  request,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Matías', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Profesional', { exact: true })).toHaveCount(0)
  await page
    .getByRole('button', { name: /^Reservar ahora/ })
    .first()
    .click()
  await page
    .locator('label:has(input[name="booking-service"][value="haircut"])')
    .click()
  const dates = page.locator('input[name="booking-date"]:not([disabled])')
  await expect(dates.nth(1)).toBeAttached()
  const date = await dates.nth(1).inputValue()
  await dates.nth(1).locator('..').click()
  await page
    .locator('input[name="booking-time"]:not([disabled])')
    .first()
    .locator('..')
    .click()
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente Navegador')
  await page.getByLabel(/Teléfono/).fill('+56900000002')
  await page
    .getByRole('button', { name: 'Revisar solicitud', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Enviar solicitud', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Tu solicitud fue enviada' }),
  ).toBeVisible()
  expect((await request.get('/api/bookings')).status()).toBe(401)
  await login(page, '/#/panel/requests')
  await page
    .getByRole('button', {
      name: 'Confirmar solicitud de Cliente Navegador',
      exact: true,
    })
    .click()
  await expect(
    page.getByText('Reserva confirmada correctamente.', { exact: true }),
  ).toBeVisible()
  await page.goto('/#/panel/schedule')
  await page.getByRole('button', { name: datePattern(date) }).click()
  await expect(
    page
      .locator('.schedule-list')
      .getByText('Cliente Navegador', { exact: true }),
  ).toBeVisible()
  const state = (
    await (await page.request.get('/api/professional/state')).json()
  ).data
  const booking = state.records.find(
    (r) => r.customerName === 'Cliente Navegador',
  )
  expect(booking.status).toBe('confirmed')
  const events = (
    await (await page.request.get(`/api/events?entityId=${booking.id}`)).json()
  ).data
  expect(events.map((e) => e.action)).toEqual(
    expect.arrayContaining(['booking.created', 'booking.confirmed']),
  )
  await fs.mkdir('test-results/evidence', { recursive: true })
  await page.screenshot({
    path: 'test-results/evidence/original-agenda.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
  await expect(
    page.getByRole('link', { name: 'Turnos', exact: true }),
  ).toHaveCount(0)
})

test('Agenda registra resultado; historial y finanzas conservan períodos y precio histórico', async ({
  page,
}) => {
  await login(page, '/#/panel/schedule')
  const { historical } = await access()
  await page.getByRole('button', { name: datePattern(historical.date) }).click()
  await page
    .getByRole('button', {
      name: `Resultado de Cliente Historial E2E a las ${historical.time}`,
      exact: true,
    })
    .click()
  const outcome = page.getByRole('group', {
    name: 'Resultado de la atención de Cliente Historial E2E',
    exact: true,
  })
  await outcome.getByRole('button', { name: 'Completar', exact: true }).click()
  await outcome
    .getByRole('button', { name: 'Confirmar resultado', exact: true })
    .click()
  await expect(
    page.getByText(`Completada: Cliente Historial E2E, ${historical.time}.`, {
      exact: true,
    }),
  ).toBeVisible()
  await page.goto('/#/panel/clients')
  await page.getByRole('searchbox').fill('Cliente Historial E2E')
  await page.getByRole('button', { name: /Cliente Historial E2E/ }).click()
  await expect(
    page
      .getByRole('region', { name: 'Detalle de Cliente Historial E2E' })
      .getByText('Completada', { exact: true }),
  ).toBeVisible()
  const state = (
    await (await page.request.get('/api/professional/state')).json()
  ).data
  await page.goto('/#/panel/finances')
  for (const [period, label] of [
    ['today', 'Hoy'],
    ['week', 'Esta semana'],
    ['month', 'Este mes'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator('.finance-revenue strong')).toHaveText(
      formatCurrency(state.financial[period].realizedIncome),
    )
    await expect(
      page
        .locator('.finance-metrics article')
        .filter({ hasText: 'Servicios completados' })
        .locator('strong'),
    ).toHaveText(String(state.financial[period].completedServices))
  }
  await page.screenshot({
    path: 'test-results/evidence/original-finances.png',
    fullPage: true,
  })
})

test('tarjetas Tu jornada enlazan a Solicitudes, Agenda y Finanzas; logout protege el panel', async ({
  page,
}) => {
  await login(page)
  for (const [label, route] of [
    ['Solicitudes', 'requests'],
    ['Próxima atención', 'schedule'],
    ['Ingresos realizados', 'finances'],
  ]) {
    await page.goto('/#/panel/dashboard')
    await page
      .locator('.dashboard-grid')
      .getByRole('link', { name: new RegExp('^' + label + ':') })
      .click()
    await expect(page).toHaveURL(new RegExp(`/panel/${route}$`))
  }
  await page.goto('/#/panel/dashboard')
  await page.getByRole('link', { name: 'Abrir agenda', exact: false }).click()
  await expect(page).toHaveURL(/\/panel\/schedule$/)
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Inicia sesión' }),
  ).toBeVisible()
  expect((await page.request.get('/api/professional/state')).status()).toBe(401)
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('incorrecta-ficticia')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Correo o contraseña incorrectos',
  )
})

test('ajustes originales: auto-guardado real de reservas, servicios y jornada; perfil manual', async ({
  page,
  request,
}) => {
  await login(page, '/#/panel/settings')
  await page.getByRole('button', { name: /^Reservas/ }).click()
  await page
    .locator('label:has(input[name="confirmation-mode"][value="automatic"])')
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Cambios guardados' }),
  ).toBeVisible()
  const automatic = await request.post('/api/bookings', {
    data: {
      id: crypto.randomUUID(),
      professionalId: 'professional-matias',
      serviceId: 'haircut',
      dateId: (
        await (await page.request.get('/api/professional/state')).json()
      ).data.records.find((r) => r.customerName === 'Cliente Navegador').dateId,
      time: '20:00',
      customer: { name: 'Cliente Automático', phone: '+56900000007' },
    },
  })
  expect(automatic.status()).toBe(201)
  expect((await automatic.json()).data.status).toBe('confirmed')
  await page
    .locator('label:has(input[name="confirmation-mode"][value="manual"])')
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Cambios guardados' }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^Reservas/ }).click()
  await expect(
    page.locator('input[name="confirmation-mode"][value="manual"]'),
  ).toBeChecked()
  await page
    .getByRole('button', { name: 'Volver a Ajustes', exact: true })
    .click()
  await page.getByRole('button', { name: /^Horarios de atención/ }).click()
  await page
    .getByRole('switch', { name: 'Domingo activo', exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Horario actualizado' }),
  ).toBeVisible()
  expect(
    (
      await (await page.request.get('/api/professional/state')).json()
    ).data.workingHours.days.find((d) => d.day === 0).enabled,
  ).toBe(false)
  await page
    .getByRole('switch', { name: 'Domingo activo', exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Horario actualizado' }),
  ).toBeVisible()
  await page.goto('/#/panel/services')
  const beard = page
    .locator('.service-card')
    .filter({ has: page.getByRole('heading', { name: 'Barba', exact: true }) })
  await beard
    .getByRole('button', { name: 'Visible en perfil', exact: true })
    .click()
  await expect(
    page.getByText('Estado actualizado.', { exact: true }),
  ).toBeVisible()
  expect(
    (
      await (await page.request.get('/api/professional/state')).json()
    ).data.services.find((s) => s.id === 'beard').publicVisible,
  ).toBe(false)
  await beard
    .getByRole('button', { name: 'Oculto en perfil', exact: true })
    .click()
  await expect(
    page.getByText('Estado actualizado.', { exact: true }),
  ).toBeVisible()
  await page.goto('/#/panel/settings')
  await page.getByRole('button', { name: /^Mi perfil/ }).click()
  const name = page.getByLabel('Nombre profesional', { exact: true })
  await name.fill('Matías E2E')
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click()
  await expect(
    page.getByText('Perfil actualizado.', { exact: true }),
  ).toBeVisible()
  expect(
    (await (await page.request.get('/api/professional/state')).json()).data
      .professional.name,
  ).toBe('Matías E2E')
  await name.fill('Matías')
  await page
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click()
  await expect(
    page.getByText('Perfil actualizado.', { exact: true }),
  ).toBeVisible()
})

test('extensión académica FIFO conservada, separada del panel principal', async ({
  page,
}) => {
  await login(page, '/#/academic/queue')
  await page.getByLabel('Servicio del turno').selectOption('beard')
  await page
    .getByLabel('Nombre ficticio', { exact: true })
    .fill('Cliente Turno')
  await page
    .getByLabel('Teléfono ficticio', { exact: true })
    .fill('+56900000003')
  await page.getByRole('button', { name: 'Emitir turno', exact: true }).click()
  await expect(
    page.getByText('Turno emitido y persistido.', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Módulo para llamar').selectOption('module-demo')
  await page
    .getByRole('button', { name: 'Llamar siguiente', exact: true })
    .click()
  await expect(
    page.getByText('Siguiente turno llamado y asignado.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Finalizar turno/ }).click()
  await expect(
    page.getByText('Atención finalizada.', { exact: true }),
  ).toBeVisible()
})

test('Swagger prueba catálogo real y documenta autenticación', async ({
  page,
}) => {
  await page.goto('/api/docs/')
  const operation = page.locator('#operations-services-servicesList')
  await operation.locator('.opblock-summary').click()
  await operation.getByRole('button', { name: 'Try it out' }).click()
  await operation.getByRole('button', { name: 'Execute', exact: true }).click()
  await expect(
    operation.locator(
      '.live-responses-table .response-col_status:not(.col_header)',
    ),
  ).toHaveText('200')
  await expect(
    operation.locator('.live-responses-table .highlight-code'),
  ).toContainText('Corte de cabello')
  const schema = await (await page.request.get('/api/openapi.json')).json()
  expect(schema.paths['/auth/login']).toBeTruthy()
  expect(schema.paths['/professional/state'].get.security).toBeTruthy()
})

test('móvil y escritorio: identidad original, navegación y errores de API', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: /^Reservar ahora/ }).first(),
  ).toBeEnabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Tu jornada' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/evidence/original-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await page.route('**/api/services', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText(
    'No pudimos conectar con la API',
  )
})
