function HolidayNotice({ state, selectedDateId }) {
  const selectedName = state.byDate.get(selectedDateId)
  return (
    <aside className="holiday-notice" aria-label="Feriados nacionales de Chile">
      <strong>Feriados de Chile · {state.years}</strong>
      <div aria-live="polite">
        {state.status === 'loading' && <p role="status">Consultando feriados… Puedes continuar reservando.</p>}
        {state.status === 'error' && (
          <div>
            <p role="alert">No pudimos consultar los feriados. Las reservas siguen disponibles.</p>
            <button type="button" onClick={state.retry}>Reintentar consulta</button>
          </div>
        )}
        {state.status === 'success' && (
          <p>{selectedName
            ? `Feriado nacional: ${selectedName}.`
            : state.holidays.length === 0
              ? 'La API no devolvió feriados nacionales para este período.'
              : selectedDateId
                ? 'La fecha seleccionada no figura como feriado nacional.'
                : 'Las fechas marcadas tienen un feriado nacional.'}</p>
        )}
      </div>
      <small>Información orientativa: un feriado no bloquea la atención.</small>
      {state.status === 'success' && state.holidays.length > 0 && (
        <details>
          <summary>Ver {state.holidays.length} feriados del período</summary>
          <ul>
            {state.holidays.map((holiday) => (
              <li key={holiday.date}>
                <time dateTime={holiday.date}>
                  {holiday.date.split('-').reverse().join('/')}
                </time>
                <span>{holiday.name}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <a href="https://nagerholidays.com/api" target="_blank" rel="noreferrer">
        Fuente: Nager.Holidays
      </a>
    </aside>
  )
}

export default HolidayNotice
