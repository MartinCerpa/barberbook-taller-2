import { etiquetaFecha } from '../../utils/panelData';

export default function RequestCard({ request, onStatusChange, busy }) {
  return <article className={`request-card request-card--${request.status}`}>
    <header className="request-card__header">
      <div><span className="request-card__reference">Cliente</span><h2>{request.customerName}</h2>
        <a href={`tel:${request.phone.replace(/\s/g, '')}`}>{request.phone}</a></div>
      <span className={`status-badge status-badge--${request.status}`}>{request.status === 'pending' ? 'Pendiente' : 'Rechazada'}</span>
    </header>
    <p className="panel-booking-date">{etiquetaFecha(request.dateId)}</p>
    <dl className="request-card__summary">
      <div className="request-card__time"><dt>Hora</dt><dd>{request.time}</dd></div>
      <div><dt>Servicio</dt><dd>{request.service}</dd><span>{request.duration} minutos</span></div>
    </dl>
    {request.status === 'pending' && <div className="request-card__actions">
      <button className="request-action request-action--reject" type="button" disabled={busy}
        aria-label={`Rechazar solicitud de ${request.customerName}`} onClick={() => onStatusChange(request.id, 'rejected')}>Rechazar</button>
      <button className="request-action request-action--accept" type="button" disabled={busy}
        aria-label={`Confirmar solicitud de ${request.customerName}`} onClick={() => onStatusChange(request.id, 'confirmed')}>Confirmar</button>
    </div>}
  </article>;
}
