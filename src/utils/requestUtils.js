const historicalStatuses = new Set(['rejected', 'expired', 'cancelled', 'completed', 'no_show'])

export const getLocalDateId = (date = new Date()) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
].join('-')

export const formatRequestDateId = (dateId) =>
  new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date(`${dateId}T12:00:00`))
    .replace(/^./, (letter) => letter.toLocaleUpperCase('es-CL'))

export const getRequestDateId = (request, referenceDateId, context) => {
  const explicitDate = request.dateId ?? request.date

  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate
  }

  if (!Number.isFinite(request.dayOrder)) {
    return null
  }

  // Los mocks existentes expresan sus fechas con dayOrder, no con su texto.
  const date = new Date(`${referenceDateId}T12:00:00`)
  date.setDate(date.getDate() + request.dayOrder - context.currentDayOrder)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const isPastRequest = (request, context) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(request.dateId)) {
    return new Date(`${request.dateId}T${request.time}:00`).getTime() <= Date.now()
  }
  if (request.dayOrder < context.currentDayOrder) {
    return true
  }

  if (request.dayOrder > context.currentDayOrder) {
    return false
  }

  return timeToMinutes(request.time) <= timeToMinutes(context.currentTime)
}

export const isHistoricalRequest = (request, context) =>
  historicalStatuses.has(request.status) || isPastRequest(request, context)

export const sortUpcomingRequests = (requests) =>
  [...requests].sort(
    (firstRequest, secondRequest) =>
      (firstRequest.dateId && secondRequest.dateId
        ? firstRequest.dateId.localeCompare(secondRequest.dateId)
        : firstRequest.dayOrder - secondRequest.dayOrder) ||
      timeToMinutes(firstRequest.time) - timeToMinutes(secondRequest.time),
  )

export const sortHistoryRequests = (requests) =>
  [...requests].sort(
    (firstRequest, secondRequest) =>
      (firstRequest.dateId && secondRequest.dateId
        ? secondRequest.dateId.localeCompare(firstRequest.dateId)
        : secondRequest.dayOrder - firstRequest.dayOrder) ||
      timeToMinutes(secondRequest.time) - timeToMinutes(firstRequest.time),
  )

export const groupRequestsByDate = (requests) =>
  requests.reduce((groups, request) => {
    const existingGroup = groups.find((group) => group.date === request.date)

    if (existingGroup) {
      existingGroup.requests.push(request)
      return groups
    }

    return [...groups, { date: request.date, requests: [request] }]
  }, [])

export const splitDateLabel = (date) => {
  const [dayLabel, ...dateParts] = date.split(',')

  return {
    dayLabel,
    dateLabel: dateParts.join(',').trim(),
  }
}
