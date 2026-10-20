import { formatBookingDate } from '../../utils/formatters'

function BookingSuccess({ booking, submittedBooking, service, onReturn }) {
  const isConfirmed = submittedBooking?.status === 'confirmed'
  return (
    <div className="booking-success">
      <span
        className={`booking-success__icon booking-success__icon--${isConfirmed ? 'confirmed' : 'pending'}`}
        aria-hidden="true"
      >
        {isConfirmed ? (
          <svg viewBox="0 0 24 24">
            <path d="m7 12 3 3 7-7" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )}
      </span>
      <p className="eyebrow">{isConfirmed ? 'Reserva confirmada' : 'Solicitud pendiente'}</p>
      <h1>{isConfirmed ? 'Tu hora quedó confirmada' : 'Tu solicitud fue enviada'}</h1>
      <p className="booking-success__message">
        {isConfirmed
          ? 'La hora fue validada y ya está incorporada a la agenda del profesional.'
          : 'El profesional debe confirmarla antes de que la hora quede reservada.'}
      </p>

      <div
        className={`booking-success__status booking-success__status--${isConfirmed ? 'confirmed' : 'pending'}`}
      >
        <span aria-hidden="true" />
        <strong>{isConfirmed ? 'Confirmada' : 'Pendiente de confirmación'}</strong>
      </div>

      <dl className="booking-success__summary">
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
      </dl>

      <p className="booking-success__payment-note">
        Reserva gratuita. El pago se realiza directamente en la barbería.
      </p>

      <button className="button button--primary" type="button" onClick={onReturn}>
        Volver al perfil
      </button>
    </div>
  )
}

export default BookingSuccess
