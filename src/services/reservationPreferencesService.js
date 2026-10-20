import { DEFAULT_BOOKING_HORIZON_DAYS } from '../data/availability.js'

export const RESERVATION_PREFERENCES_STORAGE_KEY = 'barberbook-taller-2:reservation-preferences:v1'
export const RESERVATION_PREFERENCES_CHANGE_EVENT = 'barberbook-taller-2:reservation-preferences-change'
export const CONFIRMATION_MODES = ['manual', 'automatic']
export const REQUEST_EXPIRATION_OPTIONS = [15, 30, 60, null]
export const MINIMUM_ADVANCE_OPTIONS = [0, 30, 60, 120]
export const BOOKING_HORIZON_OPTIONS = [7, DEFAULT_BOOKING_HORIZON_DAYS, 30]
export const DEFAULT_RESERVATION_PREFERENCES = Object.freeze({
  version: 1,
  confirmationMode: 'manual',
  requestExpirationMinutes: null,
  cancellationNoticeMinutes: 20,
  minimumAdvanceMinutes: 0,
  bookingHorizonDays: DEFAULT_BOOKING_HORIZON_DAYS,
})

const getStorage = () => {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

const isExpiration = (value) => REQUEST_EXPIRATION_OPTIONS.includes(value)
const isCancellationNotice = (value) => Number.isInteger(value) && value >= 0 && value <= 10080

export const sanitizeReservationPreferences = (value) => {
  const fallback = DEFAULT_RESERVATION_PREFERENCES
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    (value.version !== undefined && value.version !== 1)) return { ...fallback }
  return {
    version: 1,
    confirmationMode: CONFIRMATION_MODES.includes(value.confirmationMode)
      ? value.confirmationMode : fallback.confirmationMode,
    requestExpirationMinutes: isExpiration(value.requestExpirationMinutes)
      ? value.requestExpirationMinutes : fallback.requestExpirationMinutes,
    cancellationNoticeMinutes: isCancellationNotice(value.cancellationNoticeMinutes)
      ? value.cancellationNoticeMinutes : fallback.cancellationNoticeMinutes,
    minimumAdvanceMinutes: MINIMUM_ADVANCE_OPTIONS.includes(value.minimumAdvanceMinutes)
      ? value.minimumAdvanceMinutes : fallback.minimumAdvanceMinutes,
    bookingHorizonDays: BOOKING_HORIZON_OPTIONS.includes(value.bookingHorizonDays)
      ? value.bookingHorizonDays : fallback.bookingHorizonDays,
  }
}

const isCompleteValidPreferences = (value) => value && value.version === 1 &&
  CONFIRMATION_MODES.includes(value.confirmationMode) &&
  isExpiration(value.requestExpirationMinutes) &&
  isCancellationNotice(value.cancellationNoticeMinutes) &&
  MINIMUM_ADVANCE_OPTIONS.includes(value.minimumAdvanceMinutes) &&
  BOOKING_HORIZON_OPTIONS.includes(value.bookingHorizonDays)

export const getReservationPreferences = () => {
  try {
    const storedValue = getStorage()?.getItem(RESERVATION_PREFERENCES_STORAGE_KEY)
    return storedValue
      ? sanitizeReservationPreferences(JSON.parse(storedValue))
      : { ...DEFAULT_RESERVATION_PREFERENCES }
  } catch {
    return { ...DEFAULT_RESERVATION_PREFERENCES }
  }
}

export const saveReservationPreferences = (value) => {
  const preferences = sanitizeReservationPreferences(value)
  if (!isCompleteValidPreferences(value)) return { success: false, preferences: null }
  try {
    const storage = getStorage()
    if (!storage) return { success: false, preferences: null }
    storage.setItem(RESERVATION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
    window.dispatchEvent?.(new Event(RESERVATION_PREFERENCES_CHANGE_EVENT))
    return { success: true, preferences }
  } catch {
    return { success: false, preferences: null }
  }
}

export const subscribeReservationPreferences = (onChange) => {
  const onStorage = (event) => {
    if (event.key === null || event.key === RESERVATION_PREFERENCES_STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(RESERVATION_PREFERENCES_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(RESERVATION_PREFERENCES_CHANGE_EVENT, onChange)
  }
}

export const getRequestExpiresAt = (createdAt, preferences = getReservationPreferences()) => {
  const createdAtTime = Date.parse(createdAt)
  if (preferences.confirmationMode !== 'manual' ||
    preferences.requestExpirationMinutes === null || !Number.isFinite(createdAtTime)) return null
  return new Date(createdAtTime + preferences.requestExpirationMinutes * 60000).toISOString()
}

export const isRequestExpired = (request, now = new Date()) => request?.status === 'pending' &&
  typeof request.expiresAt === 'string' && Number.isFinite(Date.parse(request.expiresAt)) &&
  Date.parse(request.expiresAt) <= now.getTime()

