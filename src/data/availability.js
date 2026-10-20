const weekdaySchedule = [
  { time: '10:00', status: 'available' },
  { time: '11:00', status: 'pending' },
  { time: '12:00', status: 'confirmed' },
  { time: '13:00', status: 'blocked' },
  { time: '15:00', status: 'available' },
  { time: '16:00', status: 'pending' },
  { time: '17:00', status: 'available' },
  { time: '18:00', status: 'available' },
]

const saturdaySchedule = [
  { time: '10:00', status: 'pending' },
  { time: '11:00', status: 'available' },
  { time: '12:00', status: 'confirmed' },
  { time: '13:00', status: 'available' },
  { time: '14:00', status: 'blocked' },
  { time: '15:00', status: 'available' },
]

export const SLOT_INTERVAL_MINUTES = 60
export const DEFAULT_BOOKING_HORIZON_DAYS = 14
export const WEEK_DAYS = [
  { day: 1, label: 'Lunes' },
  { day: 2, label: 'Martes' },
  { day: 3, label: 'Miércoles' },
  { day: 4, label: 'Jueves' },
  { day: 5, label: 'Viernes' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
]

export const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const minutesToTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// Conserva las horas ofrecidas por los mocks, sin convertir ocupación en cierre.
export const getDefaultWeeklyHours = () => ({
  version: 1,
  days: WEEK_DAYS.map(({ day }) => {
    const slots = day === 0 ? [] : day === 6 ? saturdaySchedule : weekdaySchedule
    const intervals = []

    slots.filter((slot) => slot.status !== 'blocked').forEach(({ time }) => {
      const end = minutesToTime(timeToMinutes(time) + SLOT_INTERVAL_MINUTES)
      const previous = intervals.at(-1)
      if (previous?.end === time) {
        previous.end = end
      } else {
        intervals.push({ start: time, end })
      }
    })

    return { day, enabled: day !== 0, intervals }
  }),
})

const toDateId = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const getBookingDates = (totalDays = DEFAULT_BOOKING_HORIZON_DAYS) => {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    const isSunday = date.getDay() === 0

    return {
      id: toDateId(date),
      label:
        index === 0
          ? 'Hoy'
          : new Intl.DateTimeFormat('es-CL', { weekday: 'short' })
              .format(date)
              .replace('.', ''),
      dayNumber: date.getDate(),
      month: new Intl.DateTimeFormat('es-CL', { month: 'short' })
        .format(date)
        .replace('.', ''),
      available: !isSunday,
      note: isSunday ? 'Día libre' : 'Disponible',
    }
  })
}

export const getTimeSlotsForDate = (dateId) => {
  const date = new Date(`${dateId}T12:00:00`)
  const schedule = date.getDay() === 6 ? saturdaySchedule : weekdaySchedule

  return schedule.map((slot) => ({ ...slot }))
}
