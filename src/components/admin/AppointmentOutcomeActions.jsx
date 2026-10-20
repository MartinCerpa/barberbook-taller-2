import { useEffect, useState } from 'react'
import {
  getAppointmentOutcomeOptions, outcomeLabels, recordAppointmentOutcome,
} from '../../services/bookingService'

function AppointmentOutcomeActions({ appointment, onClose, onRecorded }) {
  const [now, setNow] = useState(() => new Date())
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const options = getAppointmentOutcomeOptions(appointment, now)
  const chosen = options.find((option) => option.id === selected)
  const record = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const result = await recordAppointmentOutcome({ appointmentId: appointment.appointmentId, outcome: selected })
      if (!result.success) { setError(result.error); return }
      onRecorded(`${outcomeLabels[selected]}: ${appointment.customerName}, ${appointment.time}.`)
      onClose()
    } catch {
      setError('No pudimos guardar el resultado. Inténtalo de nuevo.')
    } finally { setIsSaving(false) }
  }

  return (
    <div className="appointment-outcome" id={`outcome-${appointment.appointmentId}`}
      role="group" aria-label={`Resultado de la atención de ${appointment.customerName}`}>
      <p>Resultado de la atención</p>
      {chosen ? (
        <>
          <p>¿Registrar <strong>{outcomeLabels[selected].toLocaleLowerCase('es-CL')}</strong>?
            {' '}Quedará en el historial del cliente.</p>
          <div className="appointment-outcome__buttons">
            <button type="button" disabled={isSaving} onClick={() => setSelected(null)}>Volver</button>
            <button type="button" disabled={!chosen.enabled || isSaving} onClick={record}>
              {isSaving ? 'Guardando…' : 'Confirmar resultado'}
            </button>
          </div>
        </>
      ) : (
        <div className="appointment-outcome__choices">
          {options.map((option) => (
            <div key={option.id}>
              <button type="button" disabled={!option.enabled}
                aria-describedby={!option.enabled ? `${appointment.appointmentId}-${option.id}-help` : undefined}
                onClick={() => { setSelected(option.id); setError(null) }}>{option.label}</button>
              {!option.enabled && <small id={`${appointment.appointmentId}-${option.id}-help`}>{option.reason}</small>}
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default AppointmentOutcomeActions
