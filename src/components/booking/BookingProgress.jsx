const steps = ['Servicio', 'Fecha', 'Hora', 'Datos', 'Confirmar']

function BookingProgress({ currentStep, onNavigate }) {
  return (
    <nav className="booking-progress" aria-label="Progreso de la solicitud">
      <p className="booking-progress__mobile">
        Paso {currentStep + 1} de {steps.length} · {steps[currentStep]}
      </p>
      <ol>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep

          return (
            <li
              className={isCompleted ? 'is-completed' : ''}
              key={step}
            >
              <button
                type="button"
                onClick={() => onNavigate(index)}
                disabled={!isCompleted}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${index + 1}. ${step}${isCurrent ? ', paso actual' : ''}`}
              >
                <span className="booking-progress__number">
                  {isCompleted ? '✓' : index + 1}
                </span>
                <span className="booking-progress__label">{step}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default BookingProgress
