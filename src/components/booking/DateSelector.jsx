import HolidayNotice from '../HolidayNotice'
import useHolidays from '../../hooks/useHolidays'

function DateSelector({ dates, selectedId, onSelect, onBack, feedback }) {
  const holidays = useHolidays([...dates.map((date) => date.id), selectedId])
  return (
    <div className={`booking-step booking-step--date${feedback ? ' is-advancing' : ''}`}>
      <div className="booking-step__heading">
        <p className="eyebrow">Paso 2</p>
        <h1>Elige una fecha</h1>
        <p>Mostramos los próximos días de atención de Matías.</p>
      </div>

      <HolidayNotice state={holidays} selectedDateId={selectedId} />
      <fieldset className="date-options">
        <legend className="sr-only">Selecciona una fecha disponible</legend>
        {dates.map((date) => {
          const isSelected = selectedId === date.id

          return (
            <label
              className={`booking-option date-option${isSelected ? ' is-selected' : ''}`}
              key={date.id}
            >
              <input
                type="radio"
                name="booking-date"
                value={date.id}
                checked={isSelected}
                onChange={() => onSelect(date.id)}
                onClick={isSelected ? () => onSelect(date.id) : undefined}
                disabled={!date.available}
              />
              <span>{date.label}</span>
              <strong>{date.dayNumber}</strong>
              <small>{date.month}</small>
              <em>{date.note}</em>
              {holidays.byDate.has(date.id) && (
                <span className="holiday-badge">Feriado: {holidays.byDate.get(date.id)}</span>
              )}
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
