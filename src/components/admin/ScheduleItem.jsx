import { useState } from 'react'
import AppointmentOutcomeActions from './AppointmentOutcomeActions'

const statusLabels = {
  available: 'Disponible',
  confirmed: 'Confirmada',
  blocked: 'Bloqueada',
  pending: 'Con solicitudes',
  unavailable: 'No disponible',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

const actionLabels = {
  block: 'Bloquear',
  unblock: 'Desbloquear',
  enable: 'Habilitar este día',
  restore: 'Restaurar horario',
}

function ScheduleItem({
  item,
  dateLabel,
  onAvailabilityAction,
  onConfirmRequest,
  onViewRequests,
  onOutcomeRecorded,
}) {
  const actionLabel = actionLabels[item.action]
  const [isManaging, setIsManaging] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const isAppointment = ['confirmed', 'completed', 'no_show'].includes(item.status)

  const confirmRequest = async () => {
    setIsConfirming(true)
    await onConfirmRequest()
    setIsConfirming(false)
  }

  return (
    <article
      className={`schedule-item schedule-item--${item.status}${item.isNext ? ' is-next' : ''}`}
    >
      <time>{item.time}</time>
      <span className="schedule-item__marker" aria-hidden="true" />
      <div className="schedule-item__content">
        <div>
          {isAppointment ? (
            <>
              <strong>{item.customerName}</strong>
              <span>{item.service} · {item.duration} min</span>
            </>
          ) : (
            <>
              <strong>
                {item.status === 'pending' && item.pendingRequest
                  ? item.pendingRequest.customerName
                  : statusLabels[item.status]}
              </strong>
              <span>
                {item.status === 'available'
                  ? item.isEnabledException ? 'Habilitada solo para esta fecha' : 'Espacio libre para nuevas solicitudes'
                  : item.status === 'pending'
                    ? item.pendingRequest
                      ? `${item.pendingRequest.service} · Solicitud pendiente`
                      : `${item.pendingCount} por revisar`
                    : item.status === 'blocked'
                      ? 'Horario bloqueado por el profesional'
                      : 'Horario no ofrecido para reservas'}
              </span>
            </>
          )}
        </div>
        {isAppointment ? (
          <div className="schedule-item__status">
            {item.isNext && <span>Próximo</span>}
            <span className={`status-badge status-badge--${item.status}`}>{statusLabels[item.status]}</span>
            {item.status === 'confirmed' && item.appointmentId && (
              <button className="schedule-item__action" type="button"
                aria-label={`Resultado de ${item.customerName} a las ${item.time}`}
                aria-expanded={isManaging} aria-controls={`outcome-${item.appointmentId}`}
                onClick={() => setIsManaging((current) => !current)}>
                {isManaging ? 'Cerrar' : 'Resultado'}
              </button>
            )}
          </div>
        ) : actionLabel ? (
          <button
            className="schedule-item__action"
            type="button"
            onClick={onAvailabilityAction}
            aria-label={`${actionLabel} ${item.time} del ${dateLabel}`}
          >
            {actionLabel}
          </button>
        ) : item.status === 'pending' && item.pendingRequest ? (
          <button
            className="schedule-item__action schedule-item__action--confirm"
            type="button"
            onClick={confirmRequest}
            disabled={isConfirming}
            aria-label={`Confirmar solicitud de ${item.pendingRequest.customerName} a las ${item.time}`}
          >
            {isConfirming ? 'Confirmando…' : 'Confirmar'}
          </button>
        ) : item.status === 'pending' ? (
          <button
            className="schedule-item__action"
            type="button"
            onClick={onViewRequests}
            aria-label={`Ver solicitudes de las ${item.time} del ${dateLabel}`}
          >
            Ver <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
      {isManaging && item.status === 'confirmed' && (
        <AppointmentOutcomeActions appointment={item} onClose={() => setIsManaging(false)}
          onRecorded={onOutcomeRecorded} />
      )}
      {item.cancelledAppointments?.length > 0 && (
        <p className="schedule-item__cancelled">
          {item.cancelledAppointments.map((appointment) =>
            `${appointment.isLateCancellation ? 'Cancelación tardía' : 'Cancelada'} · ${appointment.customerName}`,
          ).join(' / ')}
        </p>
      )}
    </article>
  )
}

export default ScheduleItem
