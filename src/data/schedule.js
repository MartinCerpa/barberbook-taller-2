import { getTimeSlotsForDate } from './availability.js'

const appointmentExamples = [
  { customerName: 'Carlos Muñoz', service: 'Corte de cabello', duration: 45 },
  { customerName: 'Sofía Herrera', service: 'Barba', duration: 30 },
  { customerName: 'Valentina Lagos', service: 'Corte de cabello', duration: 45 },
  { customerName: 'Diego Morales', service: 'Corte + barba', duration: 60 },
  { customerName: 'Camila Soto', service: 'Barba', duration: 30 },
]

export const getScheduleAppointmentsForDate = (dateId) => {
  const date = new Date(`${dateId}T12:00:00`)

  if (date.getDay() === 0) {
    return []
  }

  // Los ejemplos describen las horas ocupadas de la misma disponibilidad base.
  return getTimeSlotsForDate(dateId)
    .filter((slot) => slot.status === 'confirmed')
    .map((slot, index) => ({
      ...appointmentExamples[(date.getDay() - 1 + index) % appointmentExamples.length],
      id: `schedule-${dateId}-${slot.time}`,
      dateId,
      time: slot.time,
      status: 'confirmed',
    }))
}
