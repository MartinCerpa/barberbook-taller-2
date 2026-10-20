import { useState } from 'react'

const PHONE_PREFIX = '+56 9'

const getSubscriberDigits = (phone) => {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('569')) {
    return digits.slice(3, 11)
  }

  if (digits.length === 9 && digits.startsWith('9')) {
    return digits.slice(1)
  }

  return digits.slice(0, 8)
}

const formatSubscriberDigits = (digits) =>
  [digits.slice(0, 4), digits.slice(4, 8)].filter(Boolean).join(' ')

const formatPhone = (digits) =>
  digits ? `${PHONE_PREFIX} ${formatSubscriberDigits(digits)}` : ''

const validateCustomer = ({ name, phone }) => {
  const errors = {}
  const isChileanMobile = getSubscriberDigits(phone).length === 8

  if (name.trim().length < 2) {
    errors.name = 'Ingresa un nombre de al menos 2 caracteres.'
  }

  if (!isChileanMobile) {
    errors.phone = 'Completa los 8 dígitos restantes de tu celular.'
  }

  return errors
}

function CustomerForm({ customer, hasPendingRequests = false, onChange, onBack, onNext }) {
  const [errors, setErrors] = useState({})
  const subscriberDigits = getSubscriberDigits(customer.phone)
  const isPhoneComplete = subscriberDigits.length === 8

  const updateField = (field, value) => {
    onChange({ ...customer, [field]: value })

    if (errors[field]) {
      setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    }
  }

  const updatePhone = (value) => {
    const nextDigits = getSubscriberDigits(value)
    updateField('phone', formatPhone(nextDigits))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validateCustomer(customer)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onNext()
  }

  return (
    <form className="booking-step customer-form" onSubmit={handleSubmit} noValidate>
      <div className="booking-step__heading">
        <p className="eyebrow">Paso 4</p>
        <h1>Tus datos de contacto</h1>
        <p>Solo los usaremos para identificar esta solicitud.</p>
      </div>

      {hasPendingRequests && (
        <div className="pending-warning pending-warning--customer" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8v5M12 17h.01M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
          </svg>
          <p>
            <strong>Este horario tiene solicitudes pendientes.</strong>
            El profesional confirmará tu solicitud.
          </p>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="customer-name">Nombre</label>
        <input
          id="customer-name"
          name="name"
          type="text"
          autoComplete="name"
          value={customer.name}
          onChange={(event) => updateField('name', event.target.value)}
          placeholder="Ej. Camila Soto"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'customer-name-error' : undefined}
        />
        {errors.name && (
          <span className="form-error" id="customer-name-error" role="alert">
            {errors.name}
          </span>
        )}
      </div>

      <div className="form-field">
        <label id="customer-phone-label" htmlFor="customer-phone">Teléfono</label>
        <div className="phone-input">
          <span className="phone-input__prefix" id="customer-phone-prefix">
            {PHONE_PREFIX}
          </span>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={formatSubscriberDigits(subscriberDigits)}
            onChange={(event) => updatePhone(event.target.value)}
            placeholder="1234 5678"
            aria-invalid={Boolean(errors.phone)}
            aria-labelledby="customer-phone-label customer-phone-prefix"
            aria-describedby={`customer-phone-help${errors.phone ? ' customer-phone-error' : ''}`}
          />
        </div>
        <span className="form-help" id="customer-phone-help">
          Ingresa los 8 dígitos restantes. {subscriberDigits.length}/8
        </span>
        {errors.phone && (
          <span className="form-error" id="customer-phone-error" role="alert">
            {errors.phone}
          </span>
        )}
      </div>

      <div className="booking-actions">
        <button className="button button--secondary" type="button" onClick={onBack}>
          Volver
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={!isPhoneComplete}
        >
          Revisar solicitud
        </button>
      </div>
    </form>
  )
}

export default CustomerForm
