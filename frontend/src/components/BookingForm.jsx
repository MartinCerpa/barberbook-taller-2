import { useEffect, useRef, useState } from 'react';
import { crearReserva } from '../services/api';
import useApiAvailability from '../hooks/useApiAvailability';
import BookingProgress from './booking/BookingProgress';
import ServiceSelector from './booking/ServiceSelector';
import DateSelector from './booking/DateSelector';
import TimeSelector from './booking/TimeSelector';
import CustomerForm from './booking/CustomerForm';
import BookingSummary from './booking/BookingSummary';
import BookingSuccess from './booking/BookingSuccess';

// Mismo recorrido y confirmación visual del BookingFlow original.
export default function BookingForm({ servicios, professionalId, automaticApproval = false, onExit }) {
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState({ serviceId: '', dateId: '', time: '', customer: { name: '', phone: '' } });
  const [submitted, setSubmitted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [revision, setRevision] = useState(0);
  const sending = useRef(false);
  const timer = useRef(null);
  const content = useRef(null);
  const availability = useApiAvailability(professionalId, booking.serviceId, revision);
  const service = servicios.find((item) => item.id === booking.serviceId);
  const dates = availability.dates;
  const slots = availability.days.find((day) => day.id === booking.dateId)?.slots ?? [];
  const selectedSlot = slots.find((slot) => slot.time === booking.time);
  const dateAvailable = dates.some((day) => day.id === booking.dateId && day.available);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    content.current?.querySelector('h1')?.focus();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  }, [step, submitted]);

  function navigate(next) {
    if (sending.current) return;
    window.clearTimeout(timer.current);
    setFeedback(null);
    setError('');
    setStep(next >= 2 && !dateAvailable ? 1 : next >= 3 && !selectedSlot?.isBookable ? 2 : next);
  }

  function advance(next, message) {
    window.clearTimeout(timer.current);
    setFeedback(message);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150;
    timer.current = window.setTimeout(() => { setFeedback(null); setError(''); setStep(next); }, delay);
  }

  async function send() {
    if (sending.current) return;
    setError('');
    const phone = booking.customer.phone.replace(/[^+\d]/g, '');
    if (!service || booking.customer.name.trim().length < 2 || !/^\+569\d{8}$/.test(phone)) {
      setError('Revisa el servicio y tus datos de contacto.'); return;
    }
    if (availability.loading || availability.error || !dateAvailable || !selectedSlot?.isBookable) {
      setError('La disponibilidad cambió. Vuelve a elegir una fecha y hora.');
      setStep(1);
      setRevision((value) => value + 1);
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const response = await crearReserva({
        serviceId: service.id, customerName: booking.customer.name.trim(), customerPhone: phone,
        // Instante calculado por PostgreSQL en America/Santiago; no se reconstruye en el navegador.
        startsAt: selectedSlot.startsAt,
      });
      setSubmitted(response);
    } catch (cause) {
      setError(cause.message);
      if ([409, 422].includes(cause.status)) {
        setStep(2);
        setBooking((current) => ({ ...current, time: '' }));
        setRevision((value) => value + 1);
      }
    } finally { sending.current = false; setBusy(false); }
  }

  return <section className="booking-section" id="inicio">
    <div className="container booking-shell" ref={content}>
      {!submitted && <>
        <div className="booking-topbar"><button type="button" onClick={onExit} disabled={busy}>← Volver al perfil</button><span>Solicitud de reserva</span></div>
        <BookingProgress currentStep={step} onNavigate={navigate} disabled={busy || !!feedback} />
      </>}
      <div className="booking-card" aria-busy={busy}>
        {error && <p className="form-error submission-error" role="alert">{error}</p>}
        {submitted ? <BookingSuccess booking={booking} submittedBooking={submitted} service={service} onReturn={onExit} /> : <>
          {step > 0 && availability.loading && <p role="status">Consultando disponibilidad…</p>}
          {step > 0 && availability.error && <div className="availability-error" role="alert">
            <p>{availability.error}</p><button className="button button--secondary" type="button" onClick={availability.retry}>Reintentar disponibilidad</button>
          </div>}
          {step === 0 && <ServiceSelector services={servicios} selectedId={booking.serviceId} onBack={onExit} feedback={feedback} onSelect={(id) => {
            if (feedback) return;
            setBooking((current) => current.serviceId === id ? current : { ...current, serviceId: id, dateId: '', time: '' });
            advance(1, 'Seleccionaste ' + servicios.find((item) => item.id === id).name);
          }} />}
          {step === 1 && <>
            {!availability.loading && !availability.error && !dates.some((day) => day.available) && <p role="status">No hay horarios disponibles en los próximos 14 días.</p>}
            <DateSelector dates={dates} selectedId={booking.dateId} onBack={() => navigate(0)} feedback={feedback} onSelect={(id) => {
              if (feedback || !dates.some((day) => day.id === id && day.available)) return;
              setBooking((current) => ({ ...current, dateId: id, time: current.dateId === id ? current.time : '' }));
              advance(2, 'Fecha seleccionada');
            }} />
          </>}
          {step === 2 && <>
            {!availability.loading && !availability.error && !slots.some((slot) => slot.isBookable) && <p role="status">Ya no quedan horas para esta fecha. Vuelve para elegir otro día.</p>}
            <TimeSelector slots={slots.map((slot) => ({ ...slot, status: slot.bookingStatus }))} selectedTime={booking.time}
              onBack={() => navigate(1)} feedback={feedback} automaticApproval={automaticApproval} onSelect={(time) => {
                if (feedback || !slots.some((slot) => slot.time === time && slot.isBookable)) return;
                setBooking((current) => ({ ...current, time }));
                advance(3, 'Horario ' + time + ' seleccionado');
              }} />
          </>}
          {step === 3 && <CustomerForm customer={booking.customer} hasPendingRequests={!automaticApproval && selectedSlot?.bookingStatus === 'pending'}
            onChange={(customer) => setBooking((current) => ({ ...current, customer }))}
            onBack={() => navigate(2)} onNext={() => navigate(4)} />}
          {step === 4 && service && <BookingSummary booking={booking} service={service} onBack={() => navigate(3)} onSubmit={send}
            busy={busy || availability.loading || !!availability.error} />}
        </>}
      </div>
    </div>
  </section>;
}
