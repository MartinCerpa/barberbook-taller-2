import { useEffect, useRef, useState } from 'react'
import {
  BOOKING_HORIZON_OPTIONS,
  getReservationPreferences,
  MINIMUM_ADVANCE_OPTIONS,
  REQUEST_EXPIRATION_OPTIONS,
  saveReservationPreferences,
} from '../../services/reservationPreferencesService.js'

const expirationLabels = { 15: '15 minutos', 30: '30 minutos', 60: '60 minutos', none: 'Sin vencimiento' }
const advanceLabels = { 0: 'Sin restricción adicional', 30: '30 minutos', 60: '1 hora', 120: '2 horas' }
const SAVED_FEEDBACK_DELAY = 140
const SAVED_FEEDBACK_DURATION = 1800
const ERROR_FEEDBACK_DURATION = 3500

function ReservationSettings({ onBack }) {
  const [preferences, setPreferences] = useState(getReservationPreferences)
  const [cancellationDraft, setCancellationDraft] = useState(
    String(preferences.cancellationNoticeMinutes),
  )
  const [saveStatus, setSaveStatus] = useState(null)
  const preferencesRef = useRef(preferences)
  const savedPreferencesRef = useRef(preferences)
  const resultTimerRef = useRef(null)
  const dismissTimerRef = useRef(null)

  const clearFeedbackTimers = () => {
    window.clearTimeout(resultTimerRef.current)
    window.clearTimeout(dismissTimerRef.current)
  }

  useEffect(() => () => {
    window.clearTimeout(resultTimerRef.current)
    window.clearTimeout(dismissTimerRef.current)
  }, [])

  const dismissFeedbackAfter = (duration) => {
    dismissTimerRef.current = window.setTimeout(() => setSaveStatus(null), duration)
  }

  const showError = (message) => {
    clearFeedbackTimers()
    setSaveStatus({ type: 'error', message })
    dismissFeedbackAfter(ERROR_FEEDBACK_DURATION)
  }

  const persistPreferences = (nextPreferences) => {
    clearFeedbackTimers()
    preferencesRef.current = nextPreferences
    setPreferences(nextPreferences)
    setSaveStatus({ type: 'saving', message: 'Guardando…' })

    const result = saveReservationPreferences(nextPreferences)
    if (!result.success) {
      const previousPreferences = savedPreferencesRef.current
      preferencesRef.current = previousPreferences
      setPreferences(previousPreferences)
      setCancellationDraft(String(previousPreferences.cancellationNoticeMinutes))
      showError('No se pudieron guardar los cambios.')
      return
    }

    preferencesRef.current = result.preferences
    savedPreferencesRef.current = result.preferences
    setPreferences(result.preferences)
    setCancellationDraft(String(result.preferences.cancellationNoticeMinutes))
    resultTimerRef.current = window.setTimeout(() => {
      setSaveStatus({ type: 'success', message: 'Cambios guardados' })
      dismissFeedbackAfter(SAVED_FEEDBACK_DURATION)
    }, SAVED_FEEDBACK_DELAY)
  }

  const updateAndSave = (field, value) => {
    if (preferencesRef.current[field] === value) {
      return
    }

    persistPreferences({ ...preferencesRef.current, [field]: value })
  }

  const updateCancellationDraft = (event) => {
    clearFeedbackTimers()
    setSaveStatus(null)
    setCancellationDraft(event.target.value)
  }

  const saveCancellationNotice = (event) => {
    const normalizedValue = event.currentTarget.value.trim()
    const value = event.currentTarget.valueAsNumber
    const isValid = event.currentTarget.validity.valid
      && normalizedValue !== ''
      && Number.isInteger(value)
      && value >= 0
      && value <= 10080

    if (!isValid) {
      setCancellationDraft(String(preferencesRef.current.cancellationNoticeMinutes))
      showError('Ingresa un valor entre 0 y 10080 minutos, en intervalos de 5.')
      return
    }

    if (value === preferencesRef.current.cancellationNoticeMinutes) {
      setCancellationDraft(String(value))
      return
    }

    persistPreferences({ ...preferencesRef.current, cancellationNoticeMinutes: value })
  }

  return (
    <div className="admin-page settings-page settings-subview reservation-settings-page">
      <button className="settings-subview__back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Volver a Ajustes
      </button>
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Reglas de reserva</p>
          <h1>Reservas</h1>
          <p>Define cómo quieres recibir y gestionar nuevas reservas.</p>
        </div>
      </header>

      <div className="reservation-settings__save-status" aria-live="polite" aria-atomic="true">
        {saveStatus && (
          <p data-type={saveStatus.type} role={saveStatus.type === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">
              {saveStatus.type === 'success' ? '✓' : saveStatus.type === 'error' ? '!' : ''}
            </span>
            {saveStatus.message}
          </p>
        )}
      </div>

      <form className="reservation-settings" onSubmit={(event) => event.preventDefault()}>
        <section className="reservation-settings__section" aria-labelledby="confirmation-title">
          <header><span>01</span><div><h2 id="confirmation-title">Confirmación</h2>
            <p>Elige un modo global para todos tus servicios.</p></div></header>
          <fieldset className="reservation-mode-options">
            <legend>Modo de confirmación</legend>
            <label className={preferences.confirmationMode === 'manual' ? 'is-selected' : ''}>
              <input type="radio" name="confirmation-mode" value="manual"
                checked={preferences.confirmationMode === 'manual'}
                onChange={() => updateAndSave('confirmationMode', 'manual')} />
              <span><strong>Manual</strong><small>Cada solicitud necesita tu aprobación antes de confirmarse.</small></span>
            </label>
            <label className={preferences.confirmationMode === 'automatic' ? 'is-selected' : ''}>
              <input type="radio" name="confirmation-mode" value="automatic"
                checked={preferences.confirmationMode === 'automatic'}
                onChange={() => updateAndSave('confirmationMode', 'automatic')} />
              <span><strong>Automática</strong><small>Confirma si la hora sigue libre y el cliente no requiere aprobación manual.</small></span>
            </label>
          </fieldset>
          {preferences.confirmationMode === 'automatic' && (
            <p className="reservation-settings__info">Los clientes con restricción siempre quedarán pendientes para tu revisión.</p>
          )}
        </section>

        <section className="reservation-settings__section" aria-labelledby="manual-requests-title">
          <header><span>02</span><div><h2 id="manual-requests-title">Solicitudes manuales</h2>
            <p>Controla cuánto tiempo compiten por una hora.</p></div></header>
          <label className="reservation-field">
            <span>Tiempo para responder una solicitud</span>
            <select value={preferences.requestExpirationMinutes ?? 'none'}
              onChange={(event) => updateAndSave('requestExpirationMinutes',
                event.target.value === 'none' ? null : Number(event.target.value))}>
              {REQUEST_EXPIRATION_OPTIONS.map((minutes) => (
                <option value={minutes ?? 'none'} key={minutes ?? 'none'}>
                  {expirationLabels[minutes ?? 'none']}
                </option>
              ))}
            </select>
            <small>Solo aplica a nuevas solicitudes creadas en modo Manual.</small>
          </label>
        </section>

        <section className="reservation-settings__section" aria-labelledby="cancellation-title">
          <header><span>03</span><div><h2 id="cancellation-title">Cancelación</h2>
            <p>Diferencia cancelaciones normales de las tardías.</p></div></header>
          <label className="reservation-field">
            <span>Cancelación sin penalización hasta</span>
            <span className="reservation-number-field">
              <input type="number" min="0" max="10080" step="5" required
                value={cancellationDraft}
                onChange={updateCancellationDraft}
                onBlur={saveCancellationNotice}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }} />
              <small>minutos antes</small>
            </span>
            <small>Después del plazo se registra como cancelación tardía, nunca como inasistencia.</small>
          </label>
        </section>

        <section className="reservation-settings__section" aria-labelledby="booking-window-title">
          <header><span>04</span><div><h2 id="booking-window-title">Cuándo pueden reservar</h2>
            <p>Define anticipación y horizonte del calendario público.</p></div></header>
          <div className="reservation-settings__fields">
            <label className="reservation-field">
              <span>Anticipación mínima</span>
              <select value={preferences.minimumAdvanceMinutes}
                onChange={(event) => updateAndSave('minimumAdvanceMinutes', Number(event.target.value))}>
                {MINIMUM_ADVANCE_OPTIONS.map((minutes) => (
                  <option value={minutes} key={minutes}>{advanceLabels[minutes]}</option>
                ))}
              </select>
            </label>
            <label className="reservation-field">
              <span>Días disponibles hacia adelante</span>
              <select value={preferences.bookingHorizonDays}
                onChange={(event) => updateAndSave('bookingHorizonDays', Number(event.target.value))}>
                {BOOKING_HORIZON_OPTIONS.map((days) => (
                  <option value={days} key={days}>{days} días</option>
                ))}
              </select>
              <small>Agenda profesional mantiene su navegación habitual.</small>
            </label>
          </div>
        </section>

      </form>
    </div>
  )
}

export default ReservationSettings
