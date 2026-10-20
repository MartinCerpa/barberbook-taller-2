import { useState } from 'react'

const PHONE_PREFIX = '+56 9'

const obtenerDigitosAbonado = (telefono) => {
  const digitos = telefono.replace(/\D/g, '')

  if (digitos.startsWith('569')) {
    return digitos.slice(3, 11)
  }

  if (digitos.length === 9 && digitos.startsWith('9')) {
    return digitos.slice(1)
  }

  return digitos.slice(0, 8)
}

const formatearDigitosAbonado = (digitos) =>
  [digitos.slice(0, 4), digitos.slice(4, 8)].filter(Boolean).join(' ')

const formatearTelefono = (digitos) =>
  digitos ? `${PHONE_PREFIX} ${formatearDigitosAbonado(digitos)}` : ''

const validarCliente = ({ name, phone }) => {
  const errores = {}
  const esCelularChileno = obtenerDigitosAbonado(phone).length === 8

  if (name.trim().length < 2) {
    errores.name = 'Ingresa un nombre de al menos 2 caracteres.'
  }

  if (!esCelularChileno) {
    errores.phone = 'Completa los 8 dígitos restantes de tu celular.'
  }

  return errores
}

function CustomerForm({ customer, hasPendingRequests = false, onChange, onBack, onNext }) {
  const [errores, setErrores] = useState({})
  const digitosAbonado = obtenerDigitosAbonado(customer.phone)
  const telefonoCompleto = digitosAbonado.length === 8

  const actualizarCampo = (campo, valor) => {
    onChange({ ...customer, [campo]: valor })

    if (errores[campo]) {
      setErrores((erroresActuales) => ({ ...erroresActuales, [campo]: undefined }))
    }
  }

  const actualizarTelefono = (valor) => {
    const nuevosDigitos = obtenerDigitosAbonado(valor)
    actualizarCampo('phone', formatearTelefono(nuevosDigitos))
  }

  const enviarFormulario = (event) => {
    event.preventDefault()
    const nuevosErrores = validarCliente(customer)

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }

    onNext()
  }

  return (
    <form className="booking-step customer-form" onSubmit={enviarFormulario} noValidate>
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
          onChange={(event) => actualizarCampo('name', event.target.value)}
          placeholder="Ej. Camila Soto"
          aria-invalid={Boolean(errores.name)}
          aria-describedby={errores.name ? 'customer-name-error' : undefined}
        />
        {errores.name && (
          <span className="form-error" id="customer-name-error" role="alert">
            {errores.name}
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
            value={formatearDigitosAbonado(digitosAbonado)}
            onChange={(event) => actualizarTelefono(event.target.value)}
            placeholder="1234 5678"
            aria-invalid={Boolean(errores.phone)}
            aria-labelledby="customer-phone-label customer-phone-prefix"
            aria-describedby={`customer-phone-help${errores.phone ? ' customer-phone-error' : ''}`}
          />
        </div>
        <span className="form-help" id="customer-phone-help">
          Ingresa los 8 dígitos restantes. {digitosAbonado.length}/8
        </span>
        {errores.phone && (
          <span className="form-error" id="customer-phone-error" role="alert">
            {errores.phone}
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
          disabled={!telefonoCompleto}
        >
          Revisar solicitud
        </button>
      </div>
    </form>
  )
}

export default CustomerForm
