import { formatCurrency } from '../../utils/formatters'
import { formatCustomerPhone } from '../../utils/customerUtils'
import { outcomeLabels } from '../../services/bookingService'

const shortDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
})

const longDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const formatDate = (date, formatter) =>
  date
    ? formatter.format(new Date(`${date}T12:00:00`)).replace('.', '')
    : 'Sin visitas aún'

const getInitials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')

const getClientStatus = (client) => {
  if (client.completedAppointments === 0) {
    return { id: 'new', label: 'Nuevo' }
  }

  if (client.completedAppointments > 1) {
    return { id: 'recurring', label: 'Recurrente' }
  }

  return { id: 'first-visit', label: 'Primera visita' }
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 10 4 4 4-4" />
    </svg>
  )
}

function ClientCard({ client, isExpanded, onToggle, onRestoreTrust }) {
  const status = getClientStatus(client)
  const detailsId = `client-details-${client.id}`
  const phoneHref = client.phone.replace(/\s/g, '')

  return (
    <article className={`client-card${isExpanded ? ' is-expanded' : ''}`}>
      <button
        className="client-card__toggle"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={onToggle}
      >
        <span className="client-card__topline">
          <span className="client-avatar" aria-hidden="true">
            {getInitials(client.name)}
          </span>
          <span className="client-card__identity">
            <strong>{client.name}</strong>
          </span>
          <span className={`client-card__status client-card__status--${status.id}`}>
            {status.label}
          </span>
          <span className="client-card__chevron">
            <ChevronIcon />
          </span>
        </span>

        {client.trustStatus === 'requires_manual_approval' && (
          <span className="client-trust-label">Requiere aprobación manual</span>
        )}

        <span className="client-card__overview">
          <span className={`client-card__activity${client.nextAppointment ? ' has-next' : ''}`}>
            <span>{client.nextAppointment ? 'Próxima reserva' : 'Última visita'}</span>
            <strong>
              {client.nextAppointment
                ? `${formatDate(client.nextAppointment.date, shortDateFormatter)} · ${client.nextAppointment.time}`
                : formatDate(client.lastVisit, shortDateFormatter)}
            </strong>
            {client.nextAppointment && <small>{client.nextAppointment.service}</small>}
          </span>
          <span className="client-card__visits">
            <strong>{client.completedAppointments}</strong>
            <span>{client.completedAppointments === 1 ? 'atención' : 'atenciones'}</span>
          </span>
        </span>
      </button>

      {isExpanded && (
        <div
          className="client-details"
          id={detailsId}
          role="region"
          aria-label={`Detalle de ${client.name}`}
        >
          <div className="client-details__metrics">
            <div>
              <span>Reservas</span>
              <strong>{client.totalAppointments}</strong>
            </div>
            <div>
              <span>Gasto acumulado</span>
              <strong>{formatCurrency(client.totalSpent)}</strong>
            </div>
          </div>

          <dl className="client-details__list">
            {client.nextAppointment && (
              <div>
                <dt>Última visita</dt>
                <dd>{formatDate(client.lastVisit, longDateFormatter)}</dd>
              </div>
            )}
            <div>
              <dt>Servicio habitual</dt>
              <dd>{client.favoriteService}</dd>
            </div>
          </dl>

          {(client.noShows > 0 || client.trustStatus === 'requires_manual_approval') && (
            <div className="client-trust" data-status={client.trustStatus}>
              <div><span>Inasistencias</span><strong>{client.noShows}</strong></div>
              <p>{client.trustStatus === 'requires_manual_approval' ? 'Requiere aprobación manual' : 'Cliente normal'}</p>
              {client.trustStatus === 'requires_manual_approval' && (
                <button type="button" onClick={onRestoreTrust}>Marcar como cliente normal</button>
              )}
            </div>
          )}

          <section className="client-history" aria-label={`Historial de ${client.name}`}>
            <h3>Historial de atenciones</h3>
            {client.history.length ? (
              <ol tabIndex={0} aria-label="Atenciones registradas">{client.history.map((entry) => (
                <li key={entry.appointmentId}>
                  <div><time dateTime={`${entry.date}T${entry.time}`}>{formatDate(entry.date, shortDateFormatter)} · {entry.time}</time>
                    <span className={`status-badge status-badge--${entry.outcome}`}>
                      {entry.isLateCancellation ? 'Cancelación tardía' : outcomeLabels[entry.outcome]}
                    </span></div>
                  <strong>{entry.service}</strong>
                  <span>{entry.price === null ? 'Precio no registrado' : formatCurrency(entry.price)}</span>
                </li>
              ))}</ol>
            ) : <p>Aún no hay resultados de atención registrados.</p>}
          </section>

          {client.notes && (
            <p className="client-details__note">
              <span>Nota</span>
              {client.notes}
            </p>
          )}

          {client.phone && <a className="client-details__phone" href={`tel:${phoneHref}`}>
            Llamar a {formatCustomerPhone(client.phone)}
            <span aria-hidden="true">→</span>
          </a>}
        </div>
      )}
    </article>
  )
}

export default ClientCard
