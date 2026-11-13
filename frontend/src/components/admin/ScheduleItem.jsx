export default function ScheduleItem({ item, isNext }) {
  const appointment = item.status === 'confirmed';
  const labels = { available: 'Disponible', pending: 'Con solicitudes', unavailable: 'Hora pasada', confirmed: 'Confirmada' };
  return <article className={`schedule-item schedule-item--${item.status}${isNext ? ' is-next' : ''}`}>
    <time dateTime={item.startsAt}>{item.time}</time>
    <span className="schedule-item__marker" aria-hidden="true" />
    <div className="schedule-item__content">
      <div><strong>{appointment ? item.customerName : item.requestCount ? item.requestCount === 1 ? item.customerName : `${item.requestCount} solicitudes` : labels[item.status]}</strong>
        <span>{appointment ? `${item.service} · ${item.duration} min · hasta ${item.endTime}` : item.requestCount ? `${item.service} · Solicitud pendiente` : item.offeredServices?.length ? `Para: ${item.offeredServices.join(' / ')}` : 'Este inicio de jornada ya pasó.'}</span></div>
      {appointment ? <div className="schedule-item__status">{isNext && <span>Próximo</span>}<span className="status-badge status-badge--confirmed">Confirmada</span></div>
        : item.status === 'pending' ? <a className="schedule-item__action" href="#/panel/requests">Ver solicitudes <span aria-hidden="true">→</span></a>
          : <span className={`status-badge status-badge--${item.status}`}>{labels[item.status]}</span>}
    </div>
  </article>;
}
