import { useEffect, useState } from 'react'
import { api } from '../../services/api.js'

const time = (minute) => `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`
export default function AvailabilityEditor({ data,run }) {
  const [professionalId,setProfessional] = useState(data.professionals.find((p) => p.active)?.id || '')
  const [weekday,setWeekday] = useState(1)
  const [intervals,setIntervals] = useState([])
  const [error,setError] = useState(null)
  const [loading,setLoading] = useState(false)
  const [revision,setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    if (!professionalId) return
    const timer = setTimeout(() => {
      setLoading(true); setError(null)
      api(`/availability/weekly?professionalId=${professionalId}`,{ signal: controller.signal })
        .then((rows) => { setIntervals(rows.filter((r) => r.weekday === weekday).map((r) => ({ start: time(r.startMinute),end: time(r.endMinute) }))); setLoading(false) })
        .catch((error) => { if (!controller.signal.aborted) { setError(error.message); setLoading(false) } })
    },0)
    return () => { clearTimeout(timer); controller.abort() }
  },[professionalId,weekday,revision])
  return <section className="fs-card"><h2>Horario semanal</h2><p>Un día sin intervalos queda cerrado. No se puede cambiar un día semanal que tenga reservas futuras pendientes o confirmadas.</p>
    {loading && <p role="status">Consultando jornada…</p>}{error && <p role="alert">{error}<button type="button" onClick={() => setRevision((v) => v+1)}>Reintentar horario</button></p>}
    <form className="fs-form" onSubmit={async (event) => { event.preventDefault(); if (await run(() => api('/availability',{ method: 'PUT',body: { professionalId,weekday,intervals } }),'Horario guardado.')) setRevision((v) => v+1) }}>
      <label>Profesional del horario<select required value={professionalId} onChange={(event) => setProfessional(event.target.value)}>{data.professionals.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Día semanal<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day,index) => <option key={day} value={index}>{day}</option>)}</select></label>
      {intervals.map((interval,index) => <div className="fs-actions" key={index}>
        <label>Inicio {index+1}<input type="time" required value={interval.start} onChange={(event) => setIntervals((items) => items.map((item,i) => i === index ? { ...item,start: event.target.value } : item))} /></label>
        <label>Fin {index+1}<input type="time" required value={interval.end} onChange={(event) => setIntervals((items) => items.map((item,i) => i === index ? { ...item,end: event.target.value } : item))} /></label>
        <button type="button" onClick={() => setIntervals((items) => items.filter((_,i) => i !== index))}>Quitar intervalo {index+1}</button>
      </div>)}
      <div className="fs-actions"><button type="button" disabled={loading || !!error || intervals.length>=10} onClick={() => setIntervals((items) => [...items,{ start: '10:00',end: '13:00' }])}>Agregar intervalo</button><button type="submit" disabled={loading || !!error || !professionalId}>Guardar horario</button></div>
    </form>
  </section>
}
