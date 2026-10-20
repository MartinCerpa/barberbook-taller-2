import { getLocalDateId } from '../utils/requestUtils.js'
import { getAppointments } from './bookingService.js'

export const FINANCIAL_PERIODS = Object.freeze([
  Object.freeze({ id: 'today', label: 'Hoy' }),
  Object.freeze({ id: 'week', label: 'Esta semana' }),
  Object.freeze({ id: 'month', label: 'Este mes' }),
])

const periodLabels = new Map(FINANCIAL_PERIODS.map((period) => [period.id, period.label]))

const assertValidDate = (date) => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('La fecha de referencia financiera no es válida.')
  }
}

const localDateAtNoon = (year, month, day) => new Date(year, month, day, 12)

export const getFinancialPeriodRange = (periodId = 'today', now = new Date()) => {
  assertValidDate(now)
  if (!periodLabels.has(periodId)) throw new RangeError(`Período financiero no válido: ${periodId}`)

  const today = localDateAtNoon(now.getFullYear(), now.getMonth(), now.getDate())
  let start = today
  let end = today

  if (periodId === 'week') {
    const daysSinceMonday = (today.getDay() + 6) % 7
    start = localDateAtNoon(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday)
    end = localDateAtNoon(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  }

  if (periodId === 'month') {
    start = localDateAtNoon(today.getFullYear(), today.getMonth(), 1)
    end = localDateAtNoon(today.getFullYear(), today.getMonth() + 1, 0)
  }

  return {
    id: periodId,
    label: periodLabels.get(periodId),
    startDateId: getLocalDateId(start),
    endDateId: getLocalDateId(end),
  }
}

const isWithinPeriod = (record, period) => typeof record?.dateId === 'string' &&
  record.dateId >= period.startDateId && record.dateId <= period.endDateId

const getHistoricalPrice = (record) => Number.isInteger(record.price) && record.price >= 0
  ? record.price
  : 0

const getTopService = (completedRecords) => {
  const services = new Map()

  completedRecords.forEach((record) => {
    const name = record.service?.trim() || 'Servicio sin nombre'
    const id = record.serviceId?.trim() || name
    const current = services.get(id)
    if (current) current.count += 1
    else services.set(id, { id, name, count: 1 })
  })

  return [...services.values()].sort((first, second) =>
    second.count - first.count ||
    first.name.localeCompare(second.name, 'es-CL', { sensitivity: 'base' }) ||
    first.id.localeCompare(second.id, 'es-CL', { sensitivity: 'base' }),
  )[0] ?? null
}

export const calculateFinancialSummary = (records, periodId = 'today', now = new Date()) => {
  const period = getFinancialPeriodRange(periodId, now)
  const periodRecords = (Array.isArray(records) ? records : []).filter((record) =>
    isWithinPeriod(record, period),
  )
  const completedRecords = periodRecords.filter((record) => record.status === 'completed')
  const realizedIncome = completedRecords.reduce((total, record) =>
    total + getHistoricalPrice(record), 0)
  const completedServices = completedRecords.length

  return {
    period,
    realizedIncome,
    completedServices,
    confirmedBookings: periodRecords.filter((record) => record.status === 'confirmed').length,
    averageTicket: completedServices === 0 ? 0 : realizedIncome / completedServices,
    topService: getTopService(completedRecords),
    attendedClients: new Set(completedRecords.map((record) => record.customerId).filter(Boolean)).size,
  }
}

export const getFinancialSummary = (periodId = 'today', now = new Date()) =>
  calculateFinancialSummary(getAppointments(), periodId, now)
