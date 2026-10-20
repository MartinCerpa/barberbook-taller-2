import { formatCurrency } from '../../utils/formatters'

function ServiceSelector({ services, selectedId, onSelect, onBack, feedback }) {
  return (
    <div className={`booking-step booking-step--services${feedback ? ' is-advancing' : ''}`}>
      <div className="booking-step__heading">
        <p className="eyebrow">Paso 1</p>
        <h1>¿Qué servicio prefieres?</h1>
        <p>Selecciona una opción para comenzar tu solicitud.</p>
      </div>

      <fieldset className="booking-options booking-options--services">
        <legend className="sr-only">Selecciona un servicio</legend>
        {services.length ? (
          services.map((service) => {
            const isSelected = selectedId === service.id

            return (
              <label
                className={`booking-option service-option${isSelected ? ' is-selected' : ''}`}
                key={service.id}
              >
                <input
                  type="radio"
                  name="booking-service"
                  value={service.id}
                  checked={isSelected}
                  onChange={() => onSelect(service.id)}
                  onClick={isSelected ? () => onSelect(service.id) : undefined}
                />
                <span className="booking-option__check" aria-hidden="true" />
                <strong>{service.name}</strong>
                <span className="service-option__description">
                  {service.description}
                </span>
                <span className="service-option__details">
                  <b>{formatCurrency(service.price)}</b>
                  <span>{service.duration} min aprox.</span>
                </span>
              </label>
            )
          })
        ) : (
          <div className="booking-options__empty" role="status">
            <strong>No hay servicios disponibles por ahora.</strong>
            <p>Vuelve más tarde o contacta directamente al profesional.</p>
          </div>
        )}
      </fieldset>

      {feedback && (
        <p className="selection-feedback" role="status">
          <span aria-hidden="true">✓</span>{feedback}
        </p>
      )}

      <div className="booking-actions booking-actions--selection booking-actions--services">
        <button
          className="button button--secondary"
          type="button"
          onClick={onBack}
        >
          Volver al perfil
        </button>
      </div>
    </div>
  )
}

export default ServiceSelector
