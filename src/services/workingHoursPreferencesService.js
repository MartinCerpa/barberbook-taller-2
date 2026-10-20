import { getDefaultWeeklyHours, timeToMinutes, WEEK_DAYS } from '../data/availability.js'
import { isValidTime, notifyAvailabilityChange } from './availabilityPreferencesService.js'

export const WORKING_HOURS_STORAGE_KEY = 'barberbook-taller-2:working-hours:v1'
export const MAX_DAILY_INTERVALS = 4

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const normalizeDay = (value) => {
  if (!value || typeof value.enabled !== 'boolean' || !Array.isArray(value.intervals)) {
    return null
  }
  if (value.intervals.length > MAX_DAILY_INTERVALS || (value.enabled && !value.intervals.length)) {
    return null
  }

  const intervals = []
  const invalidIntervals = () => value.enabled
    ? null : { day: value.day, enabled: false, intervals: [] }
  for (const interval of value.intervals) {
    if (!interval || !isValidTime(interval.start) || !isValidTime(interval.end) ||
      timeToMinutes(interval.start) >= timeToMinutes(interval.end)) {
      return invalidIntervals()
    }
    intervals.push({ start: interval.start, end: interval.end })
  }
  intervals.sort((a, b) => a.start.localeCompare(b.start))
  if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) {
    return invalidIntervals()
  }
  return { day: value.day, enabled: value.enabled, intervals }
}

// Lectura tolerante: cada día ausente o inválido conserva su default compatible.
export const sanitizeWorkingHours = (value) => {
  const fallback = getDefaultWeeklyHours()
  if (!value || (value.version !== undefined && value.version !== 1)) return fallback
  const days = Array.isArray(value) ? value : value.days
  if (!Array.isArray(days)) return fallback

  return {
    version: 1,
    days: fallback.days.map((day) => {
      const matches = days.filter((item) => item?.day === day.day)
      return matches.length === 1 ? normalizeDay(matches[0]) ?? day : day
    }),
  }
}

export const getWorkingHours = () => {
  try {
    const value = getStorage()?.getItem(WORKING_HOURS_STORAGE_KEY)
    return value ? sanitizeWorkingHours(JSON.parse(value)) : getDefaultWeeklyHours()
  } catch {
    return getDefaultWeeklyHours()
  }
}

export const saveWorkingHours = (value) => {
  const days = value?.days
  const errors = {}
  const normalizedDays = WEEK_DAYS.map(({ day, label }) => {
    const matches = Array.isArray(days) ? days.filter((item) => item?.day === day) : []
    const normalized = matches.length === 1 ? normalizeDay(matches[0]) : null
    if (!normalized) {
      errors[day] = `${label}: usa intervalos válidos, sin cruces y con inicio anterior al término.`
    }
    return normalized
  })
  if (Object.keys(errors).length || !Array.isArray(days) || days.length !== 7) {
    return { success: false, errors }
  }
  const hours = { version: 1, days: normalizedDays }
  try {
    const storage = getStorage()
    if (!storage) return { success: false, errors: {} }
    storage.setItem(WORKING_HOURS_STORAGE_KEY, JSON.stringify(hours))
    notifyAvailabilityChange()
    return { success: true, hours, errors: {} }
  } catch {
    return { success: false, errors: {} }
  }
}
