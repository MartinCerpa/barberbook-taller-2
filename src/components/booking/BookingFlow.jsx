import { useEffect, useRef, useState } from 'react'
import { createBooking, createBookingId } from '../../services/bookingService.js'
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

const initialBooking = {
  serviceId: '',
  dateId: '',
  time: '',
  customer: {
    name: '',
    phone: '',
  },
}

const SELECTION_FEEDBACK_MS = 150

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function BookingFlow({ services, onExit }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [booking, setBooking] = useState(initialBooking)
  const [selectionFeedback, setSelectionFeedback] = useState(null)
  const submissionId = useRef(null)
  const submitting = useRef(false)
  const advanceTimer = useRef(null)
  const flowContentRef = useRef(null)
  const previousStep = useRef(0)
  const [submissionError, setSubmissionError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedBooking, setSubmittedBooking] = useState(null)
  const [, refreshAvailability] = useState(0)
  useEffect(() => subscribeAvailability(() => refreshAvailability((value) => value + 1)), [])
  const dates = getPublicBookingDates()
  const slots = booking.dateId ? getEffectiveBookingTimeSlotsForDate(booking.dateId) : []
  const selectedService = services.find(
    (service) => service.id === booking.serviceId,
  )
  const selectedSlot = slots.find((slot) => slot.time === booking.time)

  useEffect(() => () => window.clearTimeout(advanceTimer.current), [])

  useEffect(() => {
    if (previousStep.current === currentStep) return
    previousStep.current = currentStep

    const focusFrame = window.requestAnimationFrame(() => {
      const heading = flowContentRef.current?.querySelector('h1')
      if (!heading) return
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(focusFrame)
  }, [currentStep])

  const scrollToFlowStart = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  const cancelScheduledAdvance = () => {
    window.clearTimeout(advanceTimer.current)
    advanceTimer.current = null
    setSelectionFeedback(null)
  }

  const advanceAfterFeedback = (nextStep, feedback) => {
    window.clearTimeout(advanceTimer.current)
    setSelectionFeedback(feedback)
    const delay = prefersReducedMotion() ? 0 : SELECTION_FEEDBACK_MS

    advanceTimer.current = window.setTimeout(() => {
      setSelectionFeedback(null)
      setCurrentStep(nextStep)
      scrollToFlowStart()
      advanceTimer.current = null
    }, delay)
  }

  const goToStep = (step) => {
    cancelScheduledAdvance()
    const dateAvailable = dates.some((date) => date.id === booking.dateId && date.available)
    const timeAvailable = slots.some((slot) => slot.time === booking.time && slot.isBookable)
    // Revalida también si los horarios cambian en otra pestaña durante la reserva.
    const nextStep = step >= 2 && !dateAvailable
      ? 1
      : step >= 3 && !timeAvailable ? 2 : step
    setCurrentStep(nextStep)
    scrollToFlowStart()
  }

  const handleServiceSelection = (serviceId) => {
    if (selectionFeedback) return
    const service = services.find((item) => item.id === serviceId)
    if (!service) return

    setBooking((currentBooking) => {
      if (currentBooking.serviceId === serviceId) {
        return currentBooking
      }

      return {
        ...currentBooking,
        serviceId,
        dateId: '',
        time: '',
      }
    })
    advanceAfterFeedback(1, `Seleccionaste ${service.name}`)
  }

  const handleDateSelection = (dateId) => {
    if (selectionFeedback) return
    const date = dates.find((item) => item.id === dateId && item.available)
    if (!date) return

    setBooking((currentBooking) => ({
      ...currentBooking,
      dateId,
      time: currentBooking.dateId === dateId ? currentBooking.time : '',
    }))
    advanceAfterFeedback(2, 'Fecha seleccionada')
  }

  const handleTimeSelection = (time) => {
    if (selectionFeedback) return
    const slot = slots.find((item) => item.time === time && item.isBookable)
    if (!slot) return

    setBooking((currentBooking) => ({ ...currentBooking, time }))
    advanceAfterFeedback(3, `Horario ${time} seleccionado`)
  }

  const submitBooking = async () => {
    if (submitting.current) return
    submitting.current = true
    setIsSubmitting(true)
    setSubmissionError(null)
    submissionId.current ??= createBookingId()
    try {
      const result = await createBooking({ ...booking, id: submissionId.current })
      if (!result.success) {
        setSubmissionError(result.error)
        return
      }
      setSubmittedBooking(result.booking)
      setCurrentStep(5)
      scrollToFlowStart()
    } catch {
      setSubmissionError('No pudimos enviar tu solicitud. Inténtalo de nuevo.')
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  if (currentStep === 5) {
    return (
      <section className="booking-section" id="inicio">
        <div className="container booking-shell" ref={flowContentRef}>
          <BookingSuccess
            booking={booking}
            submittedBooking={submittedBooking}
            service={selectedService}
            onReturn={onExit}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="booking-section" id="inicio">
      <div className="container booking-shell" ref={flowContentRef}>
        <div className="booking-topbar">
          <button type="button" onClick={onExit}>
            <span aria-hidden="true">←</span>
            Volver al perfil
          </button>
          <span>Solicitud de reserva</span>
        </div>

        <BookingProgress currentStep={currentStep} onNavigate={goToStep} />

        <div className="booking-card">
          {currentStep === 0 && (
            <ServiceSelector
              services={services}
              selectedId={booking.serviceId}
              onSelect={handleServiceSelection}
              onBack={onExit}
              feedback={selectionFeedback}
            />
          )}

          {currentStep === 1 && (
            <DateSelector
              dates={dates}
              selectedId={booking.dateId}
              onSelect={handleDateSelection}
              onBack={() => goToStep(0)}
              feedback={selectionFeedback}
            />
          )}

          {currentStep === 2 && (
            <TimeSelector
              slots={slots.map((slot) => ({ ...slot, status: slot.bookingStatus }))}
              selectedTime={booking.time}
              onSelect={handleTimeSelection}
              onBack={() => goToStep(1)}
              feedback={selectionFeedback}
            />
          )}

          {currentStep === 3 && (
            <CustomerForm
              customer={booking.customer}
              hasPendingRequests={selectedSlot?.bookingStatus === 'pending'}
              onChange={(customer) =>
                setBooking((currentBooking) => ({ ...currentBooking, customer }))
              }
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}

          {currentStep === 4 && (
            <div aria-busy={isSubmitting}>
            {submissionError && <p className="form-error" role="alert">{submissionError}</p>}
            {isSubmitting && <p role="status">Enviando solicitud…</p>}
            <BookingSummary
              booking={booking}
              service={selectedService}
              onBack={() => goToStep(3)}
              onSubmit={submitBooking}
            />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default BookingFlow
