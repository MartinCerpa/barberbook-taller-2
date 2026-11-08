import { useState } from 'react'
import RequestCard from '../admin/RequestCard.jsx'
import HolidayNotice from '../HolidayNotice.jsx'
import useHolidays from '../../hooks/useHolidays.js'
import { api,localDateId } from '../../services/api.js'
import { stateLabels } from '../../utils/stateLabels.js'

export default function BookingManager({ bookings,run,agenda = false,data }) {
  const [dateId,setDateId] = useState(agenda ? localDateId() : '')
  const [professionalId,setProfessional] = useState('')
  const [editing,setEditing] = useState(null)
  const [details,setDetails] = useState({ dateId: '',time: '',duration: 30 })
  const holidays = useHolidays(dateId ? [dateId] : [])
  const status = (id,status) => run(() => api(`/bookings/${id}/status`,{ method: 'PATCH',body: { status } }),'Estado de la reserva actualizado.')
  const edit = (id,body) => run(() => api(`/bookings/${id}`,{ method: 'PATCH',body }),'Reserva actualizada y disponibilidad revalidada.')
  const visible = bookings.filter((b) => (!dateId || b.dateId === dateId) && (!professionalId || b.professionalId === professionalId) && (!agenda || ['confirmed','completed','no_show'].includes(b.status)))
  return <>
    <section className="fs-card"><h2>{agenda ? 'Agenda del profesional' : 'Solicitudes y reservas'}</h2>
      <div className="fs-actions"><label>Filtrar fecha<input aria-label="Filtrar fecha" type="date" value={dateId} onChange={(event) => setDateId(event.target.value)} /></label><button type="button" onClick={() => setDateId('')}>Todas las fechas</button>
        <label>Filtrar profesional<select value={professionalId} onChange={(event) => setProfessional(event.target.value)}><option value="">Todos</option>{data.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      </div>
      {dateId && <HolidayNotice estado={holidays} fechaSeleccionada={dateId} />}
      <p>Las solicitudes pendientes ocupan su intervalo hasta ser confirmadas, rechazadas o canceladas. Horarios de Chile.</p>
    </section>
    {visible.length === 0 && <p role="status">No hay {agenda ? 'atenciones' : 'solicitudes'} para estos filtros.</p>}
    <div className="fs-bookings">{visible.map((booking) => <section className="fs-card" key={booking.id}>
      <p>{booking.dateId} · {booking.professionalName} · {stateLabels[booking.status]}</p>
      {['pending','confirmed'].includes(booking.status) ? <RequestCard request={{ ...booking,suggestedDuration: booking.duration }} onStatusChange={status} onDurationChange={(id,duration) => edit(id,{ duration })} onTimeChange={(id,time) => edit(id,{ time })} /> : <div><h3>{booking.customerName}</h3><p>{booking.service} · {booking.time} · {booking.duration} min</p></div>}
      {['pending','confirmed'].includes(booking.status) && <div className="fs-actions">
        <button type="button" onClick={() => { setEditing(booking.id); setDetails({ dateId: booking.dateId,time: booking.time,duration: booking.duration }) }}>Reprogramar</button>
        {booking.status === 'pending' && <button type="button" onClick={() => status(booking.id,'cancelled')}>Cancelar reserva</button>}
        {booking.status === 'confirmed' && <><button type="button" onClick={() => status(booking.id,'completed')}>Completar atención</button><button type="button" onClick={() => status(booking.id,'no_show')}>Registrar inasistencia</button></>}
      </div>}
      {editing === booking.id && <form className="fs-form" onSubmit={async (event) => { event.preventDefault(); if (await edit(booking.id,details)) setEditing(null) }}>
        <label>Nueva fecha<input required type="date" value={details.dateId} onChange={(event) => setDetails({ ...details,dateId: event.target.value })} /></label>
        <label>Nueva hora<input required type="time" value={details.time} onChange={(event) => setDetails({ ...details,time: event.target.value })} /></label>
        <label>Duración<input required type="number" min="5" max="480" value={details.duration} onChange={(event) => setDetails({ ...details,duration: Number(event.target.value) })} /></label>
        <div className="fs-actions"><button type="submit">Guardar reserva</button><button type="button" onClick={() => setEditing(null)}>Cancelar edición</button></div>
      </form>}
    </section>)}</div>
  </>
}
