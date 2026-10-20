import { useEffect, useRef, useState } from 'react'
import {
  createBooking as crearReserva,
  createBookingId as crearIdReserva,
} from '../../services/bookingService.js'
import {
  getEffectiveBookingTimeSlotsForDate,
  getPublicBookingDates,
  subscribeAvailability,
} from '../../services/availabilityService.js'
import BookingProgress from './BookingProgress'
import BookingSuccess from './BookingSuccess'
import BookingSummary from './BookingSummary'
import CustomerForm from './CustomerForm'
import DateSelector from './DateSelector'
import ServiceSelector from './ServiceSelector'
import TimeSelector from './TimeSelector'

const reservaInicial = {
  serviceId: '',
  dateId: '',
  time: '',
  customer: {
    name: '',
    phone: '',
  },
}

const ESPERA_SELECCION_MS = 150

const prefiereMovimientoReducido = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function BookingFlow({ services, onExit }) {
  const [etapaActual, setEtapaActual] = useState(0)
  const [reserva, setReserva] = useState(reservaInicial)
  const [mensajeSeleccion, setMensajeSeleccion] = useState(null)
  const idEnvio = useRef(null)
  const enviandoRef = useRef(false)
  const temporizadorAvance = useRef(null)
  const contenidoFlujoRef = useRef(null)
  const etapaAnteriorRef = useRef(0)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [estaEnviando, setEstaEnviando] = useState(false)
  const [reservaEnviada, setReservaEnviada] = useState(null)
  const [, refrescarDisponibilidad] = useState(0)
  useEffect(() => subscribeAvailability(() => refrescarDisponibilidad((valor) => valor + 1)), [])
  const fechas = getPublicBookingDates()
  const horarios = reserva.dateId ? getEffectiveBookingTimeSlotsForDate(reserva.dateId) : []
  const servicioSeleccionado = services.find(
    (servicio) => servicio.id === reserva.serviceId,
  )
  const horarioSeleccionado = horarios.find((horario) => horario.time === reserva.time)

  useEffect(() => () => window.clearTimeout(temporizadorAvance.current), [])

  useEffect(() => {
    if (etapaAnteriorRef.current === etapaActual) return
    etapaAnteriorRef.current = etapaActual

    const cuadroFoco = window.requestAnimationFrame(() => {
      const titulo = contenidoFlujoRef.current?.querySelector('h1')
      if (!titulo) return
      titulo.setAttribute('tabindex', '-1')
      titulo.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(cuadroFoco)
  }, [etapaActual])

  const desplazarAlInicio = () => {
    window.scrollTo({
      top: 0,
      behavior: prefiereMovimientoReducido() ? 'auto' : 'smooth',
    })
  }

  const cancelarAvanceProgramado = () => {
    window.clearTimeout(temporizadorAvance.current)
    temporizadorAvance.current = null
    setMensajeSeleccion(null)
  }

  const avanzarTrasConfirmacion = (siguienteEtapa, mensaje) => {
    window.clearTimeout(temporizadorAvance.current)
    setMensajeSeleccion(mensaje)
    const espera = prefiereMovimientoReducido() ? 0 : ESPERA_SELECCION_MS

    temporizadorAvance.current = window.setTimeout(() => {
      setMensajeSeleccion(null)
      setEtapaActual(siguienteEtapa)
      desplazarAlInicio()
      temporizadorAvance.current = null
    }, espera)
  }

  const irAEtapa = (etapa) => {
    cancelarAvanceProgramado()
    const fechaDisponible = fechas.some((fecha) => fecha.id === reserva.dateId && fecha.available)
    const horarioDisponible = horarios.some((horario) => horario.time === reserva.time && horario.isBookable)
    // Revalida también si los horarios cambian en otra pestaña durante la reserva.
    const siguienteEtapa = etapa >= 2 && !fechaDisponible
      ? 1
      : etapa >= 3 && !horarioDisponible ? 2 : etapa
    setEtapaActual(siguienteEtapa)
    desplazarAlInicio()
  }

  const seleccionarServicio = (serviceId) => {
    if (mensajeSeleccion) return
    const servicio = services.find((item) => item.id === serviceId)
    if (!servicio) return

    // Al cambiar de servicio, limpia la fecha y hora dependientes.
    setReserva((reservaActual) => {
      if (reservaActual.serviceId === serviceId) {
        return reservaActual
      }

      return {
        ...reservaActual,
        serviceId,
        dateId: '',
        time: '',
      }
    })
    avanzarTrasConfirmacion(1, `Seleccionaste ${servicio.name}`)
  }

  const seleccionarFecha = (dateId) => {
    if (mensajeSeleccion) return
    const fecha = fechas.find((item) => item.id === dateId && item.available)
    if (!fecha) return

    // Guarda la fecha elegida y limpia la hora si pertenece a otro día.
    setReserva((reservaActual) => ({
      ...reservaActual,
      dateId,
      time: reservaActual.dateId === dateId ? reservaActual.time : '',
    }))
    avanzarTrasConfirmacion(2, 'Fecha seleccionada')
  }

  const seleccionarHorario = (time) => {
    if (mensajeSeleccion) return
    const horario = horarios.find((item) => item.time === time && item.isBookable)
    if (!horario) return

    setReserva((reservaActual) => ({ ...reservaActual, time }))
    avanzarTrasConfirmacion(3, `Horario ${time} seleccionado`)
  }

  const enviarReserva = async () => {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setEstaEnviando(true)
    setErrorEnvio(null)
    idEnvio.current ??= crearIdReserva()
    try {
      // Persiste la solicitud solo después de revisar todos los datos.
      const resultado = await crearReserva({ ...reserva, id: idEnvio.current })
      if (!resultado.success) {
        setErrorEnvio(resultado.error)
        return
      }
      setReservaEnviada(resultado.booking)
      setEtapaActual(5)
      desplazarAlInicio()
    } catch {
      setErrorEnvio('No pudimos enviar tu solicitud. Inténtalo de nuevo.')
    } finally {
      enviandoRef.current = false
      setEstaEnviando(false)
    }
  }

  if (etapaActual === 5) {
    return (
      <section className="booking-section" id="inicio">
        <div className="container booking-shell" ref={contenidoFlujoRef}>
          <BookingSuccess
            booking={reserva}
            submittedBooking={reservaEnviada}
            service={servicioSeleccionado}
            onReturn={onExit}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="booking-section" id="inicio">
      <div className="container booking-shell" ref={contenidoFlujoRef}>
        <div className="booking-topbar">
          <button type="button" onClick={onExit}>
            <span aria-hidden="true">←</span>
            Volver al perfil
          </button>
          <span>Solicitud de reserva</span>
        </div>

        <BookingProgress currentStep={etapaActual} onNavigate={irAEtapa} />

        <div className="booking-card">
          {etapaActual === 0 && (
            <ServiceSelector
              services={services}
              selectedId={reserva.serviceId}
              onSelect={seleccionarServicio}
              onBack={onExit}
              feedback={mensajeSeleccion}
            />
          )}

          {etapaActual === 1 && (
            <DateSelector
              dates={fechas}
              selectedId={reserva.dateId}
              onSelect={seleccionarFecha}
              onBack={() => irAEtapa(0)}
              feedback={mensajeSeleccion}
            />
          )}

          {etapaActual === 2 && (
            <TimeSelector
              slots={horarios.map((horario) => ({ ...horario, status: horario.bookingStatus }))}
              selectedTime={reserva.time}
              onSelect={seleccionarHorario}
              onBack={() => irAEtapa(1)}
              feedback={mensajeSeleccion}
            />
          )}

          {etapaActual === 3 && (
            <CustomerForm
              customer={reserva.customer}
              hasPendingRequests={horarioSeleccionado?.bookingStatus === 'pending'}
              onChange={(customer) =>
                setReserva((reservaActual) => ({ ...reservaActual, customer }))
              }
              onBack={() => irAEtapa(2)}
              onNext={() => irAEtapa(4)}
            />
          )}

          {etapaActual === 4 && (
            <div aria-busy={estaEnviando}>
            {errorEnvio && <p className="form-error" role="alert">{errorEnvio}</p>}
            {estaEnviando && <p role="status">Enviando solicitud…</p>}
            <BookingSummary
              booking={reserva}
              service={servicioSeleccionado}
              onBack={() => irAEtapa(3)}
              onSubmit={enviarReserva}
            />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default BookingFlow
