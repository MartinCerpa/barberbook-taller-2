import { requestContext } from '../data/requests.js'
import {
  isHistoricalRequest,
  sortUpcomingRequests,
} from '../utils/requestUtils.js'

const DAILY_APPOINTMENT_STATUSES = new Set(['confirmed', 'completed'])

const getAppointmentTimestamp = (appointment) => {
  if (
    typeof appointment?.dateId !== 'string' ||
    typeof appointment?.time !== 'string'
  ) {
    return Number.NaN
  }

  return new Date(`${appointment.dateId}T${appointment.time}:00`).getTime()
}

const compareAppointments = (firstAppointment, secondAppointment) =>
  firstAppointment.dateId.localeCompare(secondAppointment.dateId) ||
  firstAppointment.time.localeCompare(secondAppointment.time) ||
  String(firstAppointment.id).localeCompare(String(secondAppointment.id))

export const getCurrentPendingRequests = (
  requests,
  context = requestContext,
) =>
  sortUpcomingRequests(
    requests.filter(
      (request) =>
        request.status === 'pending' &&
        !isHistoricalRequest(request, context),
    ),
  )

export const getNextConfirmedAppointment = (
  appointments,
  now = new Date(),
) => {
  const nowTimestamp = now.getTime()

  return (
    [...appointments]
      .filter(
        (appointment) =>
          appointment.status === 'confirmed' &&
          Boolean(appointment.appointmentId) &&
          getAppointmentTimestamp(appointment) >= nowTimestamp,
      )
      .sort(compareAppointments)[0] ?? null
  )
}

export const getDailyClientCount = (appointments, dateId) =>
  new Set(
    appointments
      .filter(
        (appointment) =>
          appointment.dateId === dateId &&
          DAILY_APPOINTMENT_STATUSES.has(appointment.status) &&
          appointment.customerId,
      )
      .map((appointment) => appointment.customerId),
  ).size

export const getDailyOperationsSummary = (
  appointments,
  dateId,
  now = new Date(),
) => {
  const dailyAppointments = appointments.filter(
    (appointment) =>
      appointment.dateId === dateId &&
      DAILY_APPOINTMENT_STATUSES.has(appointment.status),
  )
  const completedCount = dailyAppointments.filter(
    (appointment) => appointment.status === 'completed',
  ).length
  const confirmedCount = dailyAppointments.length - completedCount

  return {
    dateId,
    totalAppointments: dailyAppointments.length,
    completedAppointments: completedCount,
    confirmedAppointments: confirmedCount,
    clientsToday: getDailyClientCount(dailyAppointments, dateId),
    nextAppointment: getNextConfirmedAppointment(dailyAppointments, now),
  }
}
