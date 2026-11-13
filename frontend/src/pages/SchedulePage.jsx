import { useState } from 'react';
import ScheduleItem from '../components/admin/ScheduleItem';
import { adaptarReserva, etiquetaFecha, fechaChile } from '../utils/panelData';
import { obtenerAgenda } from '../services/professionalApi';
import useProfessionalResource from '../hooks/useProfessionalResource';
import ResourceState from '../components/admin/ResourceState';
import { crearAgendaItems } from '../utils/agendaItems';

export default function SchedulePage({ pending, now, onSessionExpired }) {
  const today = fechaChile(now);
  const [chosenDate, setChosenDate] = useState(today);
  const resource = useProfessionalResource(obtenerAgenda, onSessionExpired);
  const days = resource.data?.days ?? [];
  const dates = days.map((day) => day.id);
  const selectedDate = dates.includes(chosenDate) ? chosenDate : dates[0] ?? today;
  const selectedDay = days.find((day) => day.id === selectedDate);
  const appointments = (selectedDay?.bookings ?? []).filter((row) => row.status === 'confirmed').map(adaptarReserva)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const next = appointments.find((row) => new Date(row.startsAt) >= now);
  const items = selectedDay ? crearAgendaItems(selectedDay) : [];
  const timeLabel = (minute) => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
  return <div className="admin-page schedule-page">
    <header className="admin-page__heading"><div><p className="eyebrow">Jornada profesional</p><h1>Agenda</h1><p>Jornada, solicitudes y reservas reales. Horarios de America/Santiago.</p></div>
      <div className="schedule-date"><span>Vista del día</span><strong>{etiquetaFecha(selectedDate)}</strong></div></header>
    <ResourceState {...resource} onRetry={resource.reload} />
    {!resource.loading && !resource.error && selectedDay && <>
    <section className="schedule-overview" aria-label="Resumen de agenda">
      <article className={`schedule-next-appointment${next ? '' : ' is-empty'}`}><header><span>Próxima atención</span>{next && <span className="status-badge status-badge--confirmed">Confirmada</span>}</header>
        {next ? <div className="schedule-next-appointment__details"><time dateTime={next.startsAt}>{next.time}</time><div><strong>{next.customerName}</strong><span>{next.service}</span></div></div>
          : <div className="schedule-next-appointment__empty"><strong>Sin próxima atención</strong><span>No hay reservas confirmadas por comenzar en este día.</span></div>}
      </article>
      <div className="schedule-summary"><div><strong>{appointments.length}</strong><span>Confirmadas en este día</span></div>
        <div><strong>—</strong><span>Resultados no disponibles</span></div>
        <a className="schedule-summary__link" href="#/panel/requests"><strong>{pending.length}</strong><span>Solicitudes por revisar</span><span className="schedule-summary__link-action" aria-hidden="true">Ver →</span></a>
      </div>
    </section>
    <section className="schedule-availability" aria-labelledby="agenda-days"><header className="schedule-availability__heading"><div><p className="eyebrow">Disponibilidad para reservas</p><h2 id="agenda-days">Tu calendario</h2></div></header>
      <div className="schedule-date-options" role="group" aria-label="Seleccionar día de agenda">
        {dates.map((date) => { const d = new Date(`${date}T12:00:00Z`); return <button type="button" aria-pressed={date === selectedDate} aria-label={`${etiquetaFecha(date)}, ${days.find((day) => day.id === date).working ? 'día laborable' : 'día cerrado'}`} data-day-off={!days.find((day) => day.id === date).working || undefined} onClick={() => setChosenDate(date)} key={date}>
          <span>{new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', weekday: 'short' }).format(d)}</span><strong>{Number(date.slice(8))}</strong><small>{new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', month: 'short', year: 'numeric' }).format(d)}</small>
        </button>; })}
      </div>
      <p className="working-hours__note">{selectedDay.working ? 'Jornada: ' + selectedDay.intervals.map((v) => timeLabel(v.startMinute) + '–' + timeLabel(v.endMinute)).join(' · ') : 'Día cerrado según tu jornada semanal.'}</p>
    </section>
    <section className="schedule-list" aria-label={`Agenda del ${etiquetaFecha(selectedDate)}`}>
      {items.length ? items.map((item) => <ScheduleItem key={item.id} item={item} isNext={item.id === next?.id} />)
        : <p className="panel-empty" role="status">{selectedDay.working ? 'Sin horas ofrecidas para los servicios activos de este día.' : 'No se ofrecen reservas en este día.'}</p>}
      {!appointments.length && <p className="panel-agenda-note">Sin reservas confirmadas en esta fecha.</p>}
    </section>
    </>}
  </div>;
}
