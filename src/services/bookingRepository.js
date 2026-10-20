import { clients } from '../data/clients.js'
import { initialRequests, requestContext } from '../data/requests.js'
import { getBookingDates } from '../data/availability.js'
import { getScheduleAppointmentsForDate } from '../data/schedule.js'
import { services as baseServices } from '../data/services.js'
import { getRequestDateId } from '../utils/requestUtils.js'
import { normalizeCustomerPhone } from '../utils/customerUtils.js'
import { getEffectiveServices } from './serviceService.js'
import { isValidDateId, isValidTime } from './availabilityPreferencesService.js'

// Una escritura contiene solicitud, resultado e identidad. El historial es una proyección,
// no otra colección que pueda quedar a medio actualizar. Sustituible por un repositorio remoto.
export const BOOKINGS_STORAGE_KEY = 'barberbook-taller-2:bookings:v1'
export const BOOKINGS_CHANGE_EVENT = 'barberbook-taller-2:bookings-change'
export const FINAL_OUTCOMES = ['completed', 'cancelled', 'no_show']
const statuses = new Set(['pending', 'confirmed', 'rejected', 'expired', ...FINAL_OUTCOMES])
const copy = (value) => structuredClone(value)
const getStorage = () => {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

export const findOrCreateCustomer = (state, { name, phone, id, createdAt }) => {
  const normalizedPhone = normalizeCustomerPhone(phone)
  const existing = normalizedPhone && state.customers.find((client) => client.phone === normalizedPhone)
  if (existing) return existing
  const customer = {
    id: id ?? `customer-${normalizedPhone.slice(1)}`,
    name: name.trim(), phone: normalizedPhone ?? '', createdAt,
    trustStatus: 'normal', favoriteService: '', notes: '',
  }
  state.customers.push(customer)
  return customer
}

const seedService = (name) => {
  const base = baseServices.find((service) => service.name === name)
  return getEffectiveServices().find((service) => service.id === base?.id || service.name === name) ?? base
}

const seedScheduleDate = (state, dateId) => {
  if (state.scheduleSeedDates.includes(dateId)) return state
  for (const example of getScheduleAppointmentsForDate(dateId)) {
    if (state.records.some((record) => record.dateId === dateId && record.time === example.time &&
      record.status === 'confirmed')) continue
    // Solo vincula nombres conocidos dentro de los ejemplos heredados. Los clientes reales
    // se reconocen por teléfono, nunca por coincidencia de nombre.
    const customer = state.customers.find((client) => client.name === example.customerName) ??
      findOrCreateCustomer(state, {
        name: example.customerName, phone: '',
        id: `demo-${example.customerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-')}`,
        createdAt: state.referenceDateId,
      })
    const service = seedService(example.service)
    state.records.push({
      ...example, appointmentId: `appointment-${example.id}`, customerId: customer.id,
      phone: customer.phone, serviceId: service?.id ?? '', price: service?.price ?? null,
      source: 'schedule-demo', revision: 0, createdAt: state.referenceDateId,
    })
  }
  state.scheduleSeedDates.push(dateId)
  return state
}

const createInitialState = () => {
  const dates = getBookingDates()
  const state = {
    version: 1, referenceDateId: dates[0].id, scheduleSeedDates: [], records: [],
    // No migrar cantidades sin atenciones que las respalden ni inventar historial/precios.
    customers: clients.map(({ id, name, phone, createdAt, favoriteService, notes }) => ({
      id, name, phone: normalizeCustomerPhone(phone), createdAt, favoriteService, notes,
      trustStatus: 'normal',
    })),
  }
  for (const request of initialRequests) {
    const customer = findOrCreateCustomer(state, {
      id: `customer-${request.id.replace('request-', '')}`,
      name: request.customerName, phone: request.phone, createdAt: state.referenceDateId,
    })
    const service = seedService(request.service)
    state.records.push({
      ...request, dateId: getRequestDateId(request, state.referenceDateId, requestContext),
      phone: customer.phone, customerId: customer.id, serviceId: service?.id ?? '',
      price: service?.price ?? null, source: 'request', revision: 0, createdAt: state.referenceDateId,
      appointmentId: request.status === 'confirmed' ? `appointment-${request.id}` : null,
    })
  }
  dates.forEach(({ id }) => seedScheduleDate(state, id))
  return state
}

const validState = (state) => {
  if (!state || state.version !== 1 || !isValidDateId(state.referenceDateId) ||
    !Array.isArray(state.records) || !Array.isArray(state.customers) ||
    !Array.isArray(state.scheduleSeedDates) || !state.scheduleSeedDates.every(isValidDateId)) return false
  const ids = new Set()
  const phones = new Set()
  for (const customer of state.customers) {
    if (!customer || typeof customer.id !== 'string' || !customer.id || ids.has(customer.id) ||
      typeof customer.name !== 'string' || !customer.name.trim() ||
      typeof customer.phone !== 'string' ||
      typeof customer.favoriteService !== 'string' || typeof customer.notes !== 'string' ||
      (customer.phone && (normalizeCustomerPhone(customer.phone) !== customer.phone || phones.has(customer.phone))) ||
      !isValidDateId(customer.createdAt) || !['normal', 'requires_manual_approval'].includes(customer.trustStatus)) return false
    ids.add(customer.id)
    if (customer.phone) phones.add(customer.phone)
  }
  const recordIds = new Set()
  const appointmentIds = new Set()
  return state.records.every((record) => {
    if (!record || typeof record.id !== 'string' || !record.id || recordIds.has(record.id) ||
      !ids.has(record.customerId) || !statuses.has(record.status) ||
      !isValidDateId(record.dateId) || !isValidTime(record.time) ||
      typeof record.service !== 'string' || typeof record.customerName !== 'string' ||
      typeof record.phone !== 'string' || !['request', 'schedule-demo'].includes(record.source) ||
      !Number.isInteger(record.duration) || record.duration < 1 || record.duration > 480 ||
      (record.price !== null && (!Number.isInteger(record.price) || record.price < 0)) ||
      !Number.isInteger(record.revision) || record.revision < 0 ||
      (record.expiresAt !== undefined && record.expiresAt !== null &&
        !Number.isFinite(Date.parse(record.expiresAt))) ||
      (record.expiredAt !== undefined && !Number.isFinite(Date.parse(record.expiredAt))) ||
      (record.confirmationOrigin !== undefined &&
        !['manual', 'automatic'].includes(record.confirmationOrigin)) ||
      (record.isLateCancellation !== undefined && typeof record.isLateCancellation !== 'boolean')) return false
    if (record.appointmentId) {
      if (record.appointmentId !== `appointment-${record.id}` || appointmentIds.has(record.appointmentId)) return false
      appointmentIds.add(record.appointmentId)
    } else if (record.status === 'confirmed' || FINAL_OUTCOMES.includes(record.status)) return false
    if (FINAL_OUTCOMES.includes(record.status) && !Number.isFinite(Date.parse(record.outcomeRecordedAt))) return false
    if (record.status === 'expired' && !Number.isFinite(Date.parse(record.expiredAt))) return false
    if (record.status !== 'cancelled' && record.isLateCancellation === true) return false
    recordIds.add(record.id)
    return true
  })
}

export const readBookingState = () => {
  const storage = getStorage()
  try {
    const raw = storage?.getItem(BOOKINGS_STORAGE_KEY)
    if (raw) {
      const value = JSON.parse(raw)
      if (validState(value)) return value
      return { ...createInitialState(), storageIssue: true }
    }
    const initial = createInitialState()
    // Ancla los mocks a fechas reales una sola vez; no vuelven a desplazarse al recargar mañana.
    storage?.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(initial))
    return initial
  } catch {
    return { ...createInitialState(), storageIssue: true }
  }
}

export const saveBookingState = (state) => {
  try {
    const storage = getStorage()
    if (!storage || state.storageIssue || !validState(state)) return { success: false }
    // Guarda reservas y clientes en el almacenamiento local de esta aplicación.
    storage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent?.(new Event(BOOKINGS_CHANGE_EVENT))
    return { success: true }
  } catch { return { success: false } }
}

export const subscribeBookings = (onChange) => {
  const onStorage = (event) => {
    if (event.key === null || event.key === BOOKINGS_STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(BOOKINGS_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(BOOKINGS_CHANGE_EVENT, onChange)
  }
}

export const getScheduleBookings = (dateId, state = readBookingState()) => {
  if (!isValidDateId(dateId)) return []
  seedScheduleDate(state, dateId)
  return state.records.filter((record) => record.source === 'schedule-demo' && record.dateId === dateId).map(copy)
}

export const readStateForAppointment = (appointmentId) => {
  const state = readBookingState()
  const match = /^appointment-schedule-(\d{4}-\d{2}-\d{2})-\d{2}:\d{2}$/.exec(appointmentId)
  if (match && isValidDateId(match[1])) seedScheduleDate(state, match[1])
  return state
}
