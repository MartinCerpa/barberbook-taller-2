import { useState } from 'react'
import {
  requestDurationOptions,
  requestTimeOptions,
} from '../../data/requests'

const statusLabels = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
}

function RequestCard({
  request,
  onStatusChange,
  onDurationChange,
  onTimeChange,
}) {
  const [isManaging, setIsManaging] = useState(false)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const isPending = request.status === 'pending'
  const isConfirmed = request.status === 'confirmed'
  const availableTimeOptions = requestTimeOptions.includes(request.time)
    ? requestTimeOptions
    : [request.time, ...requestTimeOptions]

  return (
    <article className={`request-card request-card--${request.status}`}>
      <header className="request-card__header">
        <div>
          <span className="request-card__reference">Cliente</span>
          <h2>{request.customerName}</h2>
          <a href={`tel:${request.phone.replace(/\s/g, '')}`}>{request.phone}</a>
        </div>
        <span className={`status-badge status-badge--${request.status}`}>
          {statusLabels[request.status]}
        </span>
      </header>

      <dl className="request-card__summary">
        <div className="request-card__time">
          <dt>Hora</dt>
          <dd>{request.time}</dd>
        </div>
        <div>
          <dt>Servicio</dt>
          <dd>{request.service}</dd>
          <span>{request.duration} minutos</span>
        </div>
      </dl>

      {isPending && (
        <div className="request-card__duration">
          <div>
            <strong>Duración estimada</strong>
            <span>Sugerencia: {request.suggestedDuration} minutos</span>
          </div>
          <label>
            <span className="sr-only">
              Ajustar duración para la solicitud de {request.customerName}
            </span>
            <select
              value={request.duration}
              aria-label={`Duración para la solicitud de ${request.customerName}`}
              onChange={(event) =>
                onDurationChange(request.id, Number(event.target.value))
              }
            >
              {requestDurationOptions.map((duration) => (
                <option value={duration} key={duration}>
                  {duration} min
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {isPending && (
        <div className="request-card__actions">
          <button
            className="request-action request-action--reject"
            type="button"
            aria-label={`Rechazar solicitud de ${request.customerName}`}
            onClick={() => onStatusChange(request.id, 'rejected')}
          >
            Rechazar
          </button>
          <button
            className="request-action request-action--accept"
            type="button"
            aria-label={`Confirmar solicitud de ${request.customerName}`}
            onClick={() => onStatusChange(request.id, 'confirmed')}
          >
            Confirmar
          </button>
        </div>
      )}

      {isConfirmed && (
        <div className="request-card__confirmed">
          <div className="request-card__confirmed-heading">
            <p role="status">Reserva incorporada a la agenda.</p>
            <button
              className="request-manage-toggle"
              type="button"
              aria-expanded={isManaging}
              onClick={() => {
                setIsManaging((currentValue) => !currentValue)
                setIsEditingTime(false)
              }}
            >
              {isManaging ? 'Cerrar' : 'Gestionar'}
            </button>
          </div>

          {isManaging && (
            <div className="request-card__manage-panel">
              <div className="request-card__manage-actions">
                <button
                  type="button"
                  aria-expanded={isEditingTime}
                  onClick={() => setIsEditingTime((currentValue) => !currentValue)}
                >
                  Cambiar horario
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange(request.id, 'pending')}
                >
                  Volver a pendiente
                </button>
                <button
                  className="request-card__cancel-action"
                  type="button"
                  onClick={() => onStatusChange(request.id, 'cancelled')}
                >
                  Cancelar reserva
                </button>
              </div>

              {isEditingTime && (
                <label className="request-card__time-editor">
                  <span>Nuevo horario simulado</span>
                  <select
                    value={request.time}
                    onChange={(event) => onTimeChange(request.id, event.target.value)}
                  >
                    {availableTimeOptions.map((time) => (
                      <option value={time} key={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default RequestCard
