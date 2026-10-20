import { useEffect, useState } from 'react'
import HolidayNotice from '../components/HolidayNotice'
import useFeriados from '../hooks/useHolidays'
import ScheduleItem from '../components/admin/ScheduleItem'
import { getUnfinishedAppointmentDates } from '../services/bookingService'
import { getDailyOperationsSummary } from '../services/bookingInsightsService.js'
import {
  blockTimeSlot,
  enableTimeSlot,
  getAvailabilityRequestsForDate,
  getBookingDates,
  getEffectiveTimeSlotsForDate,
  restoreTimeSlot,
  subscribeAvailability,
  unblockTimeSlot,
} from '../services/availabilityService.js'
import { formatRequestDateId } from '../utils/requestUtils'

const availabilityActions = {
  block: blockTimeSlot,
  unblock: unblockTimeSlot,
  enable: enableTimeSlot,
  restore: restoreTimeSlot,
}

function SchedulePage({
  requests,
  pendingRequestCount = 0,
  onConfirmRequest,
  onViewRequests,
}) {
  const [, refreshAvailability] = useState(0)
  useEffect(() => subscribeAvailability(() => refreshAvailability((value) => value + 1)), [])
  const upcomingDates = getBookingDates(undefined, requests)
  const [selectedDateId, setSelectedDateId] = useState(
    () => upcomingDates[0]?.id ?? '',
  )
  const unfinishedDates = getUnfinishedAppointmentDates()
  const selectedPreviousDate = selectedDateId < upcomingDates[0]?.id && !unfinishedDates.includes(selectedDateId)
    ? [selectedDateId] : []
  const previousDates = [...unfinishedDates, ...selectedPreviousDate].map((id) => {
    const date = new Date(`${id}T12:00:00`)
    return { id, label: unfinishedDates.includes(id) ? 'Por cerrar' : 'Anterior', dayNumber: date.getDate(), isPrevious: true,
      month: date.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '') }
  })
  const bookingDates = [upcomingDates[0], ...previousDates, ...upcomingDates.slice(1)].filter(Boolean)
  const [availabilityFeedback, setAvailabilityFeedback] = useState(null)
  const referenceDateId = bookingDates[0]?.id
  const dateLabel = selectedDateId ? formatRequestDateId(selectedDateId) : ''
  // Los feriados complementan la agenda sin modificar la disponibilidad.
  const estadoFeriados = useFeriados([selectedDateId])
  const dayRequests = getAvailabilityRequestsForDate(selectedDateId, requests)
  const pendingRequestsByTime = dayRequests.reduce((requestsByTime, request) => {
    if (request.status !== 'pending') {
      return requestsByTime
    }

    const slotRequests = requestsByTime.get(request.time) ?? []
    requestsByTime.set(request.time, [...slotRequests, request])
    return requestsByTime
  }, new Map())
  const timelineItems = selectedDateId
    ? getEffectiveTimeSlotsForDate(selectedDateId, dayRequests)
    : []
  const {
    confirmedAppointments: appointmentsToCloseCount,
    completedAppointments: completedCount,
    nextAppointment,
  } = getDailyOperationsSummary(timelineItems, selectedDateId)

  const updateAvailability = (slot) => {
    // Aplica un bloqueo o habilitación solo a la fecha seleccionada.
    const result = availabilityActions[slot.action]?.(selectedDateId, slot.time, dayRequests)

    if (!result?.success) {
      setAvailabilityFeedback({
        type: 'error',
        message: 'No pudimos actualizar este horario en el navegador.',
      })
      return
    }

    setAvailabilityFeedback({
      type: 'success',
      message: {
        block: `${slot.time} quedó bloqueada para esta fecha.`,
        unblock: `Bloqueo de ${slot.time} retirado para esta fecha.`,
        enable: `${slot.time} habilitada solo para esta fecha.`,
        restore: `${slot.time} vuelve a seguir el horario habitual.`,
      }[slot.action],
    })
  }

  const confirmPendingRequest = async (request) => {
    // Una solicitud confirmada se incorpora inmediatamente a la agenda.
    const result = await onConfirmRequest(request.id)

    if (!result?.success) {
      setAvailabilityFeedback({
        type: 'error',
        message: result?.error ?? 'No pudimos confirmar esta solicitud.',
      })
      return false
    }

    setAvailabilityFeedback({
      type: 'success',
      message: `Solicitud de ${request.customerName} confirmada.`,
    })
    return true
  }

  return (
    <div className="admin-page schedule-page">
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Jornada profesional</p>
          <h1>Agenda</h1>
          <p>
            Revisa atenciones, espacios disponibles y bloqueos con una lectura
            rápida de toda la jornada.
          </p>
        </div>
        <div className="schedule-date">
          <span>Vista del día</span>
          <strong>{dateLabel}</strong>
        </div>
      </header>

      <section className="schedule-overview" aria-label="Resumen de agenda">
        <article className={`schedule-next-appointment${nextAppointment ? '' : ' is-empty'}`}>
          <header>
            <span>Próxima atención</span>
            {nextAppointment && (
              <span className="status-badge status-badge--confirmed">Confirmada</span>
            )}
          </header>
          {nextAppointment ? (
            <div className="schedule-next-appointment__details">
              <time dateTime={`${selectedDateId}T${nextAppointment.time}:00`}>
                {nextAppointment.time}
              </time>
              <div>
                <strong>{nextAppointment.customerName}</strong>
                <span>{nextAppointment.service}</span>
              </div>
            </div>
          ) : (
            <div className="schedule-next-appointment__empty">
              <strong>Sin próxima atención</strong>
              <span>No hay reservas confirmadas por comenzar en este día.</span>
            </div>
          )}
        </article>

        <div className="schedule-summary">
          <div>
            <strong>{appointmentsToCloseCount}</strong>
            <span>Por cerrar</span>
          </div>
          <div>
            <strong>{completedCount}</strong>
            <span>Completadas</span>
          </div>
          <a
            className="schedule-summary__link"
            href="#/panel/requests"
            aria-label={`Ver ${pendingRequestCount} solicitudes por revisar`}
          >
            <strong>{pendingRequestCount}</strong>
            <span>Solicitudes por revisar</span>
            <span className="schedule-summary__link-action" aria-hidden="true">
              Ver →
            </span>
          </a>
        </div>
      </section>

      <section
        className="schedule-availability"
        aria-labelledby="schedule-availability-title"
      >
        <header className="schedule-availability__heading">
          <div>
            <p className="eyebrow">Disponibilidad para reservas</p>
            <h2 id="schedule-availability-title">Gestiona horas</h2>
          </div>
        </header>

        <div
          className="schedule-date-options"
          role="group"
          aria-label="Seleccionar día de agenda"
        >
          {bookingDates.map((date) => (
            <button
              type="button"
              aria-pressed={selectedDateId === date.id}
              aria-label={`${formatRequestDateId(date.id)}${date.isPrevious ? ', atenciones por cerrar' : date.available ? '' : ', sin horas disponibles'}`}
              data-day-off={!date.available && !date.isPrevious || undefined}
              onClick={() => {
                setSelectedDateId(date.id)
                setAvailabilityFeedback(null)
              }}
              key={date.id}
            >
              <span>{date.label}</span>
              <strong>{date.dayNumber}</strong>
              <small>{date.month}</small>
              {estadoFeriados.porFecha.has(date.id) && <span className="holiday-badge">Feriado</span>}
            </button>
          ))}
        </div>
        <HolidayNotice estado={estadoFeriados} fechaSeleccionada={selectedDateId} />
      </section>

      <section className="schedule-list" aria-label={`Agenda del ${dateLabel}`}>
        {timelineItems.map((item) => {
          const slotRequests = pendingRequestsByTime.get(item.time) ?? []
          const pendingRequest = item.status === 'pending' && slotRequests.length === 1
            ? slotRequests[0]
            : null

          return (
            <ScheduleItem
              item={{
                ...item,
                isNext: item.id === nextAppointment?.id,
                pendingRequest,
              }}
              dateLabel={dateLabel}
              onAvailabilityAction={() => updateAvailability(item)}
              onConfirmRequest={() => confirmPendingRequest(pendingRequest)}
              onOutcomeRecorded={(message) => setAvailabilityFeedback({ type: 'success', message })}
              onViewRequests={() =>
                onViewRequests({
                  dateId: selectedDateId,
                  time: item.time,
                  referenceDateId,
                })
              }
              key={item.id}
            />
          )
        })}
      </section>
      <div className="schedule-availability__feedback" aria-live="polite">
        {availabilityFeedback ? (
          <p data-type={availabilityFeedback.type}>
            {availabilityFeedback.message}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default SchedulePage
