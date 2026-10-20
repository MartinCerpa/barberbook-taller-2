import {
  FINAL_OUTCOMES, findOrCreateCustomer, readBookingState, saveBookingState, subscribeBookings,
} from './bookingRepository.js'
import { getLocalDateId } from '../utils/requestUtils.js'
import { normalizeCustomerPhone } from '../utils/customerUtils.js'

export { subscribeBookings as subscribeCustomers }

const historyFromState = (state, customerId) => state.records
  .filter((record) => record.customerId === customerId && record.appointmentId && FINAL_OUTCOMES.includes(record.status))
  .sort((a, b) => b.dateId.localeCompare(a.dateId) || b.time.localeCompare(a.time) || a.id.localeCompare(b.id))
  .map((record) => ({
    appointmentId: record.appointmentId, date: record.dateId, time: record.time,
    serviceId: record.serviceId, service: record.service, price: record.price,
    duration: record.duration, outcome: record.status, recordedAt: record.outcomeRecordedAt,
    isLateCancellation: Boolean(record.isLateCancellation),
  }))

const summaryFromState = (state, customer, now) => {
  const history = historyFromState(state, customer.id)
  const completed = history.filter((entry) => entry.outcome === 'completed')
  const appointments = state.records.filter((record) => record.customerId === customer.id &&
    record.appointmentId && (record.status === 'confirmed' || FINAL_OUTCOMES.includes(record.status)))
  const next = appointments.filter((record) => record.status === 'confirmed' &&
    new Date(`${record.dateId}T${record.time}:00`) >= now)
    .sort((a, b) => a.dateId.localeCompare(b.dateId) || a.time.localeCompare(b.time))[0]
  return {
    ...customer, history, lastVisit: completed[0]?.date ?? null,
    completedAppointments: completed.length,
    totalAppointments: appointments.length,
    totalSpent: completed.reduce((total, entry) => total + entry.price, 0),
    noShows: history.filter((entry) => entry.outcome === 'no_show').length,
    lateCancellations: history.filter((entry) => entry.isLateCancellation).length,
    nextAppointment: next ? { date: next.dateId, time: next.time, service: next.service } : null,
    favoriteService: customer.favoriteService || 'Por definir',
  }
}

export const getClientHistory = (customerId) => historyFromState(readBookingState(), customerId)
export const getClientSummary = (customerId, now = new Date()) => {
  const state = readBookingState()
  const customer = state.customers.find((item) => item.id === customerId)
  return customer ? summaryFromState(state, customer, now) : null
}
export const getCustomersSnapshot = (now = new Date()) => {
  const state = readBookingState()
  return state.customers.map((customer) => summaryFromState(state, customer, now))
}
export const getCustomers = async () => getCustomersSnapshot()
export const getCustomerById = async (customerId) => getClientSummary(customerId)

export const createCustomer = async (customerData) => {
  const phone = normalizeCustomerPhone(customerData.phone)
  const name = customerData.name?.trim()
  if (!phone || !name || name.length < 2) return { success: false, error: 'Nombre o teléfono inválido.' }
  const state = readBookingState()
  const customer = findOrCreateCustomer(state, { name, phone, createdAt: getLocalDateId() })
  return saveBookingState(state).success ? { success: true, customer } : { success: false }
}

export const setClientTrustStatus = (customerId, trustStatus) => {
  if (!['normal', 'requires_manual_approval'].includes(trustStatus)) return { success: false }
  const state = readBookingState()
  const customer = state.customers.find((item) => item.id === customerId)
  if (!customer) return { success: false }
  // La rehabilitación no cambia resultados. Leer el historial no vuelve a activar la
  // restricción; únicamente registrar otra inasistencia puede hacerlo.
  customer.trustStatus = trustStatus
  return saveBookingState(state)
}

export const customerService = {
  getCustomers,
  getCustomerById,
  createCustomer,
  getClientHistory,
  getClientSummary,
  getCustomersSnapshot,
  setClientTrustStatus,
}
