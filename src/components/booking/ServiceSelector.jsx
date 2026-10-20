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
          services.map((servicio) => {
            const estaSeleccionado = selectedId === servicio.id

            return (
              <label
                className={`booking-option service-option${estaSeleccionado ? ' is-selected' : ''}`}
                key={servicio.id}
              >
                <input
                  type="radio"
                  name="booking-service"
                  value={servicio.id}
                  checked={estaSeleccionado}
                  onChange={() => onSelect(servicio.id)}
                  onClick={estaSeleccionado ? () => onSelect(servicio.id) : undefined}
                />
                <span className="booking-option__check" aria-hidden="true" />
                <strong>{servicio.name}</strong>
                <span className="service-option__description">
                  {servicio.description}
                </span>
                <span className="service-option__details">
                  <b>{formatCurrency(servicio.price)}</b>
                  <span>{servicio.duration} min aprox.</span>
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
