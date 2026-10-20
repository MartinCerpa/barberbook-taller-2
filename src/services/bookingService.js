import {
  FINAL_OUTCOMES, findOrCreateCustomer, readBookingState,
  readStateForAppointment, saveBookingState, subscribeBookings,
} from './bookingRepository.js'
import {
  getEffectiveBookingTimeSlotsForDate, getEffectiveTimeSlotsForDate,
} from './availabilityService.js'
import { getServiceById } from './serviceService.js'
import { isValidDateId, isValidTime } from './availabilityPreferencesService.js'
import { formatRequestDateId, getLocalDateId } from '../utils/requestUtils.js'
import { normalizeCustomerPhone } from '../utils/customerUtils.js'
import {
  getRequestExpiresAt, getReservationPreferences, isRequestExpired,
} from './reservationPreferencesService.js'

export { subscribeBookings }
export const outcomeLabels = { completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' }
const failure = (error) => ({ success: false, error })
const storageFailure = () => failure('No pudimos guardar el cambio en este navegador. Inténtalo de nuevo.')
const SLOT_TAKEN_EXPIRATION_REASON = 'slot-taken'

const expireRequestsInState = (state, now = new Date()) => {
  let changed = false
  state.records = state.records.map((record) => {
    if (!isRequestExpired(record, now)) return record
    changed = true
    return { ...record, status: 'expired', expiredAt: now.toISOString(), revision: record.revision + 1 }
  })
  return changed
}

export const expirePendingRequests = (now = new Date()) => {
  const state = readBookingState()
  const changed = expireRequestsInState(state, now)
  if (!changed) return { success: true, changed: false }
  if (!saveBookingState(state).success) return storageFailure()
  return { success: true, changed: true }
}

export const getRequestsSnapshot = (now = new Date()) => {
  const state = readBookingState()
  if (expireRequestsInState(state, now)) saveBookingState(state)
  return state.records
    .filter((record) => record.source !== 'schedule-demo')
    .map((record) => ({ ...record, date: formatRequestDateId(record.dateId) }))
}

export const getBookings = async () => getRequestsSnapshot()
export const getAppointments = () => readBookingState().records.filter((record) =>
  record.appointmentId && (record.status === 'confirmed' || FINAL_OUTCOMES.includes(record.status)),
)

export const getUnfinishedAppointmentDates = (now = new Date()) => [...new Set(
  getAppointments().filter((record) => record.status === 'confirmed' && record.dateId < getLocalDateId(now))
    .map((record) => record.dateId),
)].sort().reverse()

export const createBookingId = () => `request-local-${typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`

const isSlotBookable = (dateId, time, state, { applyPublicRules = false, now = new Date() } = {}) => {
  const records = state.records.filter((record) => record.source !== 'schedule-demo' && record.dateId === dateId)
  const slots = applyPublicRules
    ? getEffectiveBookingTimeSlotsForDate(dateId, { requests: records, now })
    : getEffectiveTimeSlotsForDate(dateId, records)
  return slots.some((slot) => slot.time === time && slot.isBookable)
}

const commitRecord = (state, current, changes, undoable = false) => {
  const booking = { ...current, ...changes, revision: current.revision + 1 }
  state.records = state.records.map((record) => record.id === current.id ? booking : record)
  if (!saveBookingState(state).success) return storageFailure()
  return {
    success: true, changed: true, booking,
    undoToken: undoable ? { recordId: current.id, revision: booking.revision, previous: current } : null,
  }
}

const confirmRequestInState = (state, current, now, { origin = 'manual', undoable = false } = {}) => {
  const confirmedAt = now.toISOString()
  const competingRequests = state.records.filter((record) => record.id !== current.id &&
    record.source === 'request' && record.status === 'pending' &&
    record.dateId === current.dateId && record.time === current.time &&
    record.professionalId === current.professionalId)
  const previousRecords = [current, ...competingRequests]
  const nextRecords = new Map()
  const booking = {
    ...current,
    status: 'confirmed',
    appointmentId: `appointment-${current.id}`,
    confirmedAt,
    confirmationOrigin: origin,
    revision: current.revision + 1,
  }
  nextRecords.set(booking.id, booking)
  competingRequests.forEach((record) => {
    nextRecords.set(record.id, {
      ...record,
      status: 'expired',
      expiredAt: confirmedAt,
      expirationReason: SLOT_TAKEN_EXPIRATION_REASON,
      revision: record.revision + 1,
    })
  })
  state.records = state.records.map((record) => nextRecords.get(record.id) ?? record)
  if (!saveBookingState(state).success) return storageFailure()
  const expiredBookings = competingRequests.map((record) => nextRecords.get(record.id))
  return {
    success: true,
    changed: true,
    booking,
    expiredBookings,
    undoToken: undoable ? {
      recordId: current.id,
      records: previousRecords.map((previous) => ({
        recordId: previous.id,
        revision: nextRecords.get(previous.id).revision,
        previous,
      })),
    } : null,
  }
}

export const createBooking = async (bookingData, now = new Date()) => {
  const phone = normalizeCustomerPhone(bookingData.customer?.phone)
  const name = bookingData.customer?.name?.trim()
  if (!phone || !name || name.length < 2 || name.length > 100 ||
    !isValidDateId(bookingData.dateId) || !isValidTime(bookingData.time)) {
    return failure('Revisa el nombre, teléfono, fecha y hora de la solicitud.')
  }
  const service = await getServiceById(bookingData.serviceId)
  if (!service?.active) return failure('El servicio ya no está disponible. Elige otro servicio.')
  // Lee después de la consulta: dos envíos concurrentes no reutilizan una copia desactualizada.
  let state = readBookingState()
  if (expireRequestsInState(state, now)) {
    if (!saveBookingState(state).success) return storageFailure()
    state = readBookingState()
  }
  const id = bookingData.id ?? createBookingId()
  const existing = state.records.find((record) => record.id === id)
  if (existing) {
    return existing.phone === phone && existing.dateId === bookingData.dateId &&
      existing.time === bookingData.time && existing.serviceId === service.id
      ? { success: true, changed: false, booking: existing }
      : failure('Esta solicitud ya fue utilizada. Vuelve a iniciar la reserva.')
  }
  if (!isSlotBookable(bookingData.dateId, bookingData.time, state, { applyPublicRules: true, now })) {
    return failure('La hora elegida ya no está disponible. Selecciona otra hora.')
  }
  const customer = findOrCreateCustomer(state, { name, phone, createdAt: getLocalDateId() })
  const preferences = getReservationPreferences()
  const automaticallyConfirmed = preferences.confirmationMode === 'automatic' &&
    customer.trustStatus !== 'requires_manual_approval'
  const createdAt = now.toISOString()
  const booking = {
    id, appointmentId: null,
    customerId: customer.id, customerName: name, phone,
    serviceId: service.id, service: service.name, price: service.price,
    duration: service.duration, suggestedDuration: service.duration,
    dateId: bookingData.dateId, time: bookingData.time,
    status: 'pending', source: 'request', createdAt,
    expiresAt: automaticallyConfirmed ? null : getRequestExpiresAt(createdAt, preferences),
    confirmationOrigin: automaticallyConfirmed ? 'automatic' : 'manual',
    confirmedAt: undefined,
    revision: 0,
  }
  state.records.push(booking)
  if (automaticallyConfirmed) {
    return confirmRequestInState(state, booking, now, { origin: 'automatic' })
  }
  return saveBookingState(state).success ? { success: true, changed: true, booking } : storageFailure()
}

export const acceptRequest = (bookingId, now = new Date()) => {
  const state = readBookingState()
  const expiredChanged = expireRequestsInState(state, now)
  const current = state.records.find((record) => record.id === bookingId)
  if (!current) return failure('No encontramos esta solicitud.')
  if (current.status === 'confirmed') return { success: true, changed: false, booking: current }
  if (current.status === 'expired') {
    if (expiredChanged && !saveBookingState(state).success) return storageFailure()
    return failure('Esta solicitud venció y ya no puede confirmarse.')
  }
  if (current.status !== 'pending') return failure('Solo se puede confirmar una solicitud pendiente.')
  if (!Number.isInteger(current.price) || current.price < 0) return failure('La solicitud no tiene un precio de servicio válido.')
  if (!isSlotBookable(current.dateId, current.time, state)) return failure('Este horario ya no se puede confirmar.')
  return confirmRequestInState(state, current, now, { origin: 'manual', undoable: true })
}

export const getAppointmentOutcomeOptions = (appointment, now = new Date()) => {
  const start = new Date(`${appointment.dateId}T${appointment.time}:00`).getTime()
  const duration = Number.isInteger(appointment.duration) && appointment.duration > 0 ? appointment.duration : 0
  const end = start + duration * 60000
  const noShowFrom = start + 15 * 60000
  const active = appointment.status === 'confirmed'
  const timeLabel = (time) => new Date(time).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const options = [
    { id: 'completed', label: 'Completar', availableAt: end,
      reason: `Disponible desde el término previsto: ${timeLabel(end)}.` },
    { id: 'cancelled', label: 'Cancelar', availableAt: -Infinity, reason: '' },
    { id: 'no_show', label: 'No asistió', availableAt: noShowFrom,
      reason: `Disponible 15 minutos después del inicio: ${timeLabel(noShowFrom)}.` },
  ]
  return options.map((option) => ({ ...option,
    enabled: active && Number.isFinite(start) && now.getTime() >= option.availableAt &&
      (option.id !== 'completed' || Number.isInteger(appointment.price)),
  }))
}

export const recordAppointmentOutcome = ({ appointmentId, outcome }, now = new Date()) => {
  if (!FINAL_OUTCOMES.includes(outcome)) return failure('Resultado de atención inválido.')
  const state = readStateForAppointment(appointmentId)
  const current = state.records.find((record) => record.appointmentId === appointmentId)
  if (!current) return failure('No encontramos esta atención.')
  if (current.status === outcome) return { success: true, changed: false, booking: current }
  if (current.status !== 'confirmed') return failure('Esta atención ya tiene un resultado o no está confirmada.')
  const option = getAppointmentOutcomeOptions(current, now).find((item) => item.id === outcome)
  if (!option.enabled) return failure(option.reason || 'No se puede registrar este resultado todavía.')
  if (outcome === 'no_show') {
    const noShows = state.records.filter((record) => record.customerId === current.customerId && record.status === 'no_show').length + 1
    if (noShows >= 2) {
      state.customers = state.customers.map((customer) => customer.id === current.customerId
        ? { ...customer, trustStatus: 'requires_manual_approval' } : customer)
    }
  }
  const changes = { status: outcome, outcomeRecordedAt: now.toISOString() }
  if (outcome === 'cancelled') {
    const start = new Date(`${current.dateId}T${current.time}:00`).getTime()
    const notice = getReservationPreferences().cancellationNoticeMinutes
    changes.isLateCancellation = now.getTime() > start - notice * 60000
    changes.cancellationNoticeMinutes = notice
  }
  return commitRecord(state, current, changes)
}

export const updateBookingStatus = (bookingId, status) => {
  if (status === 'confirmed') return acceptRequest(bookingId)
  const state = readBookingState()
  const current = state.records.find((record) => record.id === bookingId)
  if (!current) return failure('No encontramos esta solicitud.')
  if (current.status === status) return { success: true, changed: false, booking: current }
  if (status === 'cancelled') {
    const result = recordAppointmentOutcome({ appointmentId: current.appointmentId, outcome: status })
    return result.success && result.changed
      ? { ...result, undoToken: { recordId: current.id, revision: result.booking.revision, previous: current } }
      : result
  }
  if (!((status === 'rejected' && current.status === 'pending') ||
    (status === 'pending' && current.status === 'confirmed'))) return failure('Esta transición no está permitida.')
  return commitRecord(state, current, { status }, true)
}

export const undoBookingChange = (token) => {
  const state = readBookingState()
  const entries = Array.isArray(token?.records) && token.records.length > 0
    ? token.records
    : token?.recordId ? [token] : []
  const uniqueRecordIds = new Set(entries.map((entry) => entry.recordId))
  const currentRecords = entries.map((entry) => state.records.find((record) => record.id === entry.recordId))
  const invalidToken = entries.length === 0 || uniqueRecordIds.size !== entries.length ||
    entries.some((entry, index) => {
      const current = currentRecords[index]
      return !current || current.revision !== entry.revision || entry.previous?.id !== current.id ||
        ['completed', 'no_show'].includes(current.status)
    })
  if (invalidToken) return failure('El registro cambió; ya no se puede deshacer esta acción.')
  const unavailableRestoration = entries.some((entry, index) => entry.previous.status === 'confirmed' &&
    !isSlotBookable(currentRecords[index].dateId, entry.previous.time, state))
  if (unavailableRestoration) {
    return failure('No se puede restaurar la reserva porque el horario ya no está disponible.')
  }
  const restoredRecords = new Map(entries.map((entry, index) => [entry.recordId, {
    ...entry.previous,
    revision: currentRecords[index].revision + 1,
  }]))
  state.records = state.records.map((record) => restoredRecords.get(record.id) ?? record)
  if (!saveBookingState(state).success) return storageFailure()
  return {
    success: true,
    changed: true,
    booking: restoredRecords.get(token.recordId) ?? restoredRecords.values().next().value,
    undoToken: null,
  }
}

export const updateBookingDetails = (bookingId, changes) => {
  const state = readBookingState()
  const current = state.records.find((record) => record.id === bookingId)
  if (!current || !['pending', 'confirmed'].includes(current.status)) return failure('Esta reserva ya no admite cambios.')
  const update = {}
  if (changes.duration !== undefined) {
    if (current.status !== 'pending' || ![30, 45, 60].includes(changes.duration)) return failure('Selecciona una duración válida.')
    update.duration = changes.duration
  }
  if (changes.time !== undefined) {
    if (!isValidTime(changes.time)) return failure('Selecciona una hora válida.')
    if (changes.time !== current.time && !isSlotBookable(current.dateId, changes.time, state)) return failure('La nueva hora no está disponible.')
    update.time = changes.time
  }
  return commitRecord(state, current, update)
}

export const confirmBooking = async (bookingId) => acceptRequest(bookingId)
export const rejectBooking = async (bookingId) => updateBookingStatus(bookingId, 'rejected')

export const bookingService = {
  getBookings,
  createBooking,
  confirmBooking,
  rejectBooking,
  acceptRequest,
  recordAppointmentOutcome,
  getAppointments,
  getRequestsSnapshot,
  updateBookingStatus,
  updateBookingDetails,
  undoBookingChange,
  subscribeBookings,
  expirePendingRequests,
}
