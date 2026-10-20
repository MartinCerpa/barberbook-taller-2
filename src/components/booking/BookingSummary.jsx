import { formatBookingDate, formatCurrency } from '../../utils/formatters'

function BookingSummary({ booking, service, onBack, onSubmit }) {
  return (
    <div className="booking-step">
      <div className="booking-step__heading">
        <p className="eyebrow">Paso 5</p>
        <h1>Revisa tu solicitud</h1>
        <p>Confirma que los datos estén correctos antes de enviarla.</p>
      </div>

      <div className="summary-layout">
        <dl className="booking-details">
          <div>
            <dt>Servicio</dt>
            <dd>{service.name}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{formatBookingDate(booking.dateId)}</dd>
          </div>
          <div>
            <dt>Hora</dt>
            <dd>{booking.time}</dd>
          </div>
          <div>
            <dt>Nombre</dt>
            <dd>{booking.customer.name.trim()}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{booking.customer.phone}</dd>
          </div>
        </dl>

        <div className="price-summary">
          <h2>Detalle del servicio</h2>
          <div>
            <span>{service.name}</span>
            <strong>{formatCurrency(service.price)}</strong>
          </div>
          <div className="price-summary__total">
            <span>Total</span>
            <strong>{formatCurrency(service.price)}</strong>
          </div>
          <p className="price-summary__notice">
            Reserva gratuita. El pago se realiza directamente en la barbería.
          </p>
        </div>
      </div>

      <div className="booking-actions">
        <button className="button button--secondary" type="button" onClick={onBack}>
          Volver
        </button>
        <button className="button button--primary" type="button" onClick={onSubmit}>
          Enviar solicitud
        </button>
      </div>
    </div>
  )
}

export default BookingSummary
