import { useEffect, useRef, useState } from 'react'
import { getDefaultWeeklyHours, WEEK_DAYS } from '../../data/availability.js'
import {
  getWorkingHours,
  MAX_DAILY_INTERVALS,
  saveWorkingHours,
} from '../../services/workingHoursPreferencesService.js'

const SAVED_FEEDBACK_DELAY = 140
const SAVED_FEEDBACK_DURATION = 1800
const ERROR_FEEDBACK_DURATION = 3500

const copyDay = (day) => ({
  ...day,
  intervals: day.intervals.map((interval) => ({ ...interval })),
})

const replaceDay = (hours, dayId, nextDay) => ({
  ...hours,
  days: hours.days.map((day) => day.day === dayId ? copyDay(nextDay) : day),
})

function WorkingHoursSettings({ onBack }) {
  const [hours, setHours] = useState(getWorkingHours)
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const hoursRef = useRef(hours)
  const savedHoursRef = useRef(hours)
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

  const setCurrentHours = (nextHours) => {
    hoursRef.current = nextHours
    setHours(nextHours)
  }

  const dismissFeedbackAfter = (duration) => {
    dismissTimerRef.current = window.setTimeout(() => setFeedback(null), duration)
  }

  const showError = () => {
    clearFeedbackTimers()
    setFeedback({
      type: 'error',
      message: 'El horario no pudo actualizarse. Mantuvimos el horario anterior.',
    })
    dismissFeedbackAfter(ERROR_FEEDBACK_DURATION)
  }

  const clearDayError = (dayId) => {
    setErrors((current) => ({ ...current, [dayId]: null }))
  }

  const persistDay = (dayId, nextDay) => {
    const savedDay = savedHoursRef.current.days.find((day) => day.day === dayId)

    if (!savedDay || JSON.stringify(savedDay) === JSON.stringify(nextDay)) {
      clearDayError(dayId)
      return
    }

    clearFeedbackTimers()
    setFeedback({ type: 'saving', message: 'Guardando...' })

    const candidate = replaceDay(savedHoursRef.current, dayId, nextDay)
    const result = saveWorkingHours(candidate)

    if (!result.success) {
      if (result.errors[dayId]) {
        setErrors((current) => ({ ...current, [dayId]: result.errors[dayId] }))
      } else {
        const rollbackHours = replaceDay(hoursRef.current, dayId, savedDay)
        setCurrentHours(rollbackHours)
        clearDayError(dayId)
      }

      showError()
      return
    }

    const normalizedDay = result.hours.days.find((day) => day.day === dayId)
    savedHoursRef.current = result.hours
    setCurrentHours(replaceDay(hoursRef.current, dayId, normalizedDay))
    clearDayError(dayId)

    resultTimerRef.current = window.setTimeout(() => {
      setFeedback({ type: 'success', message: 'Horario actualizado' })
      dismissFeedbackAfter(SAVED_FEEDBACK_DURATION)
    }, SAVED_FEEDBACK_DELAY)
  }

  const updateDay = (dayId, update) => {
    const currentDay = hoursRef.current.days.find((day) => day.day === dayId)
    const nextDay = update(copyDay(currentDay))

    setCurrentHours(replaceDay(hoursRef.current, dayId, nextDay))
    clearDayError(dayId)
    clearFeedbackTimers()
    setFeedback(null)
    return nextDay
  }

  const toggleDay = (dayId) => {
    const savedDay = savedHoursRef.current.days.find((day) => day.day === dayId)
    const defaults = getDefaultWeeklyHours().days.find((item) => item.day === dayId)
    const nextDay = {
      ...savedDay,
      enabled: !savedDay.enabled,
      intervals: savedDay.intervals.length ? savedDay.intervals : defaults.intervals.length
        ? defaults.intervals : [{ start: '10:00', end: '13:00' }],
    }

    updateDay(dayId, () => nextDay)
    persistDay(dayId, nextDay)
  }

  const updateInterval = (dayId, index, field, value) => updateDay(dayId, (day) => ({
    ...day,
    intervals: day.intervals.map((interval, i) => i === index
      ? { ...interval, [field]: value } : interval),
  }))

  const hasIncompleteNewInterval = (dayId, day) => {
    const savedDay = savedHoursRef.current.days.find((item) => item.day === dayId)
    return day.intervals.some((interval, index) =>
      index >= savedDay.intervals.length && (!interval.start || !interval.end),
    )
  }

  const finishDayEditing = (dayId) => {
    const day = hoursRef.current.days.find((item) => item.day === dayId)

    if (hasIncompleteNewInterval(dayId, day)) {
      return
    }

    persistDay(dayId, day)
  }

  const removeInterval = (dayId, index) => {
    const nextDay = updateDay(dayId, (day) => ({
      ...day,
      intervals: day.intervals.filter((_, intervalIndex) => intervalIndex !== index),
    }))

    if (!hasIncompleteNewInterval(dayId, nextDay)) {
      persistDay(dayId, nextDay)
    }
  }

  return (
    <div className="admin-page settings-page settings-subview working-hours-page">
      <button className="settings-subview__back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Volver a Ajustes
      </button>
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Tu semana habitual</p>
          <h1>Horarios de atención</h1>
          <p>Define cuándo trabajas. Las excepciones de una fecha se gestionan desde Agenda.</p>
        </div>
      </header>

      <div className="working-hours__save-status" aria-live="polite" aria-atomic="true">
        {feedback && (
          <p data-type={feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">
              {feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '!' : ''}
            </span>
            {feedback.message}
          </p>
        )}
      </div>

      <form className="working-hours" onSubmit={(event) => event.preventDefault()}>
        <p className="working-hours__note">Las horas de inicio se ofrecen cada 60 minutos. La hora de término no se ofrece como inicio.</p>
        <div className="working-hours__days">
          {WEEK_DAYS.map(({ day: dayId, label }) => {
            const day = hours.days.find((item) => item.day === dayId)
            return (
              <section className="working-hours__day" aria-labelledby={`working-day-${dayId}`} key={dayId}>
                <header>
                  <h2 id={`working-day-${dayId}`}>{label}</h2>
                  <button type="button" className="working-hours__toggle" role="switch"
                    aria-checked={day.enabled} aria-label={`${label} activo`}
                    onClick={() => toggleDay(dayId)}>
                    <span aria-hidden="true" />{day.enabled ? 'Activo' : 'Cerrado'}
                  </button>
                </header>
                {day.enabled ? (
                  <>
                    <div className="working-hours__intervals">
                      {day.intervals.map((interval, index) => (
                        <div className="working-hours__interval" key={index}>
                          <label>
                            <span>Desde</span>
                            <input type="time" step="60" required value={interval.start}
                              aria-label={`${label}, inicio ${index + 1}`}
                              aria-invalid={Boolean(errors[dayId])}
                              aria-describedby={errors[dayId] ? `hours-error-${dayId}` : undefined}
                              onInput={(event) => updateInterval(dayId, index, 'start', event.currentTarget.value)}
                              onBlur={() => finishDayEditing(dayId)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }
                              }} />
                          </label>
                          <span className="working-hours__separator" aria-hidden="true">—</span>
                          <label>
                            <span>Hasta</span>
                            <input type="time" step="60" required value={interval.end}
                              aria-label={`${label}, término ${index + 1}`}
                              aria-invalid={Boolean(errors[dayId])}
                              aria-describedby={errors[dayId] ? `hours-error-${dayId}` : undefined}
                              onInput={(event) => updateInterval(dayId, index, 'end', event.currentTarget.value)}
                              onBlur={() => finishDayEditing(dayId)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }
                              }} />
                          </label>
                          <button className="working-hours__remove" type="button"
                            aria-label={`Eliminar intervalo ${index + 1} de ${label}`}
                            disabled={day.intervals.length === 1}
                            onClick={() => removeInterval(dayId, index)}>×</button>
                        </div>
                      ))}
                    </div>
                    <button className="working-hours__add" type="button"
                      disabled={day.intervals.length >= MAX_DAILY_INTERVALS}
                      onClick={() => updateDay(dayId, (current) => ({ ...current,
                        intervals: [...current.intervals, { start: '', end: '' }],
                      }))}>Agregar intervalo<span className="sr-only"> a {label}</span></button>
                  </>
                ) : <p className="working-hours__closed">No se ofrecen nuevas reservas este día.</p>}
                {errors[dayId] && <p className="working-hours__error" id={`hours-error-${dayId}`} role="alert">{errors[dayId]}</p>}
              </section>
            )
          })}
        </div>
      </form>
    </div>
  )
}

export default WorkingHoursSettings
