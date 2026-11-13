
function DateSelector({ dates, selectedId, onSelect, onBack, feedback }) {
  return (
    <div className={`booking-step booking-step--date${feedback ? ' is-advancing' : ''}`}>
      <div className="booking-step__heading">
        <p className="eyebrow">Paso 2</p>
        <h1 tabIndex={-1}>Elige una fecha</h1>
        <p>Mostramos los próximos días de atención del profesional seleccionado.</p>
      </div>

      <fieldset className="date-options">
        <legend className="sr-only">Selecciona una fecha disponible</legend>
        {dates.map((fecha) => {
          const estaSeleccionada = selectedId === fecha.id

          return (
            <label
              className={`booking-option date-option${estaSeleccionada ? ' is-selected' : ''}`}
              key={fecha.id}
            >
              <input
                type="radio"
                name="booking-date"
                value={fecha.id}
                checked={estaSeleccionada}
                onChange={() => onSelect(fecha.id)}
                onClick={estaSeleccionada ? () => onSelect(fecha.id) : undefined}
                disabled={!fecha.available}
              />
              <span>{fecha.label}</span>
              <strong>{fecha.dayNumber}</strong>
              <small>{fecha.month}</small>
              <em>{fecha.note}</em>
            </label>
          )
        })}
      </fieldset>

      {feedback && (
        <p className="selection-feedback" role="status">
          <span aria-hidden="true">✓</span>{feedback}
        </p>
      )}

      <div className="booking-actions booking-actions--selection">
        <button className="button button--secondary" type="button" onClick={onBack}>
          Volver
        </button>
      </div>
    </div>
  )
}

export default DateSelector
