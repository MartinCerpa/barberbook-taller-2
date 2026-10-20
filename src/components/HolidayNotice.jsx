function HolidayNotice({ estado, fechaSeleccionada }) {
  const nombreFeriado = estado.porFecha.get(fechaSeleccionada)
  if (estado.estado === 'listo' && !nombreFeriado) return null

  return (
    <div className="holiday-status" aria-live="polite">
      {estado.estado === 'cargando' && (
        <p className="holiday-status__loading" role="status">Consultando feriados…</p>
      )}
      {estado.estado === 'error' && (
        <div className="holiday-status__error">
          <p role="alert">No pudimos consultar los feriados.</p>
          <button type="button" onClick={estado.reintentar}>Reintentar</button>
        </div>
      )}
      {estado.estado === 'listo' && nombreFeriado && (
        <p className="holiday-status__selected">Feriado: {nombreFeriado}</p>
      )}
    </div>
  )
}

export default HolidayNotice
