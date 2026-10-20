import { isPastRequest } from '../../utils/requestUtils'

const statusLabels = {
  pending: 'Sin resolver',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  completed: 'Completada',
  no_show: 'No asistió',
}

function RequestHistoryCard({ request, context }) {
  const visualStatus = request.status === 'expired' ||
    request.status === 'pending' && isPastRequest(request, context)
    ? 'expired' : request.status

  return (
    <article className={`request-history-card request-history-card--${visualStatus}`}>
      <header>
        <div>
          <span>Cliente</span>
          <h2>{request.customerName}</h2>
        </div>
        <span className={`status-badge status-badge--${visualStatus}`}>
          {visualStatus === 'expired' ? 'Expirada' : request.isLateCancellation
            ? 'Cancelación tardía' : statusLabels[request.status]}
        </span>
      </header>

      <dl>
        <div>
          <dt>Servicio</dt>
          <dd>{request.service}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{request.date}</dd>
        </div>
        <div>
          <dt>Hora</dt>
          <dd>{request.time}</dd>
        </div>
      </dl>

      {request.expirationReason === 'slot-taken' ? (
        <p className="request-history-card__reason">
          El horario fue asignado a otra solicitud.
        </p>
      ) : null}
    </article>
  )
}

export default RequestHistoryCard
