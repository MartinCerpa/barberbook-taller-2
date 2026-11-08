import { useCallback, useEffect, useRef, useState } from 'react'
import AdminLayout from '../layouts/AdminLayout.jsx'
import { api } from '../services/api.js'
import CatalogEditor from '../components/fullstack/CatalogEditor.jsx'
import QueueManager from '../components/fullstack/QueueManager.jsx'
import { stateLabels } from '../utils/stateLabels.js'
import BookingManager from '../components/fullstack/BookingManager.jsx'
import AvailabilityEditor from '../components/fullstack/AvailabilityEditor.jsx'

const titles = { dashboard: 'Inicio',requests: 'Solicitudes',schedule: 'Agenda',clients: 'Clientes',finances: 'Finanzas',services: 'Servicios',settings: 'Administración',queue: 'Turnos',history: 'Historial' }
const paths = { bookings: '/bookings?limit=500',branches: '/branches',services: '/services',professionals: '/professionals',modules: '/modules',tickets: '/tickets?limit=500',metrics: '/metrics',customers: '/customers',history: '/history?limit=100',events: '/events?limit=100',blocks: '/availability/blocks' }

export default function ApiAdminPanel({ activeSection,navigationKey,onNavigate,academic=false }) {
  const [data,setData] = useState(null)
  const [error,setError] = useState(null)
  const [message,setMessage] = useState(null)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const running = useRef(false)
  const version = useRef(0)
  const invalidate = useCallback(() => { version.current++ },[])
  const refresh = useCallback(async () => {
    const requestVersion = ++version.current
    const results = await Promise.allSettled(Object.values(paths).map((path) => api(path)))
    if (requestVersion !== version.current) return
    const failures = []
    const values = {}
    Object.keys(paths).forEach((key,index) => {
      if (results[index].status === 'fulfilled') values[key] = results[index].value
      else failures.push(`${key}: ${results[index].reason.message}`)
    })
    // Si MongoDB no responde, el resto del panel conserva las operaciones SQL.
    if (failures.length) setError(failures.join(' ')); else setError(null)
    setData((previous) => ({ ...(previous || {}),...values }))
    setLoading(false)
  },[])
  useEffect(() => {
    const initial = setTimeout(refresh,0)
    const timer = setInterval(refresh,15000)
    return () => { clearTimeout(initial); clearInterval(timer); invalidate() }
  },[refresh,invalidate])
  const run = async (work,successMessage) => {
    if (running.current) return false
    running.current=true; setBusy(true); setError(null); setMessage(null)
    try { await work(); setMessage(successMessage); await refresh(); return true }
    catch (error) { setError(error.message); return false }
    finally { running.current=false; setBusy(false) }
  }
  const ready = data && ['bookings','branches','services','professionals','modules','tickets','metrics','customers','history','blocks'].every((key) => data[key] !== undefined)
  const metrics = data?.metrics
  const section = () => {
    if (activeSection === 'requests' || activeSection === 'schedule') return <BookingManager bookings={data.bookings} agenda={activeSection === 'schedule'} data={data} run={run} />
    if (activeSection === 'queue') return <QueueManager data={data} run={run} />
    if (activeSection === 'services') return <CatalogEditor key="services" resource="services" data={data} run={run} />
    if (activeSection === 'settings') return <><p>Configuración académica compartida y persistida en el servidor. El tema visual se conserva por navegador.</p>{['branches','professionals','modules'].map((resource) => <CatalogEditor key={resource} resource={resource} data={data} run={run} />)}<AvailabilityEditor data={data} run={run} /><BlockManager data={data} run={run} /></>
    if (activeSection === 'clients') return <section className="fs-card"><h2>Clientes ficticios</h2>{!data.customers.length && <p>No hay clientes registrados.</p>}{data.customers.map((c) => <div className="fs-row" key={c.id}><strong>{c.name}</strong><span>{c.phone} · {c.completed} atenciones · ${c.spent}</span></div>)}</section>
    if (activeSection === 'history') return <><section className="fs-card"><h2>Historial operacional</h2>{!data.history.length && <p>No hay operaciones finalizadas.</p>}{data.history.map((item) => <div className="fs-row" key={`${item.type}-${item.id}`}><span>{item.type === 'ticket' ? 'Turno' : 'Reserva'} · {stateLabels[item.status]}</span><small>{new Date(item.occurredAt).toLocaleString('es-CL')} · {item.id}</small></div>)}</section><section className="fs-card"><h2>Trazabilidad MongoDB</h2>{!data.events ? <p>La trazabilidad no está disponible. Reintenta la actualización.</p> : !data.events.length ? <p>No hay eventos registrados.</p> : data.events.map((event) => <div className="fs-row" key={event._id}><div><strong>{event.action}</strong><small>{event.entityId}</small></div><span>{new Date(event.occurredAt).toLocaleString('es-CL')}</span></div>)}</section></>
    return <><section className="fs-card"><h2>{activeSection === 'finances' ? 'Ingresos realizados' : 'Resumen de operación'}</h2><p>Acumulado de registros persistidos. Los ingresos incluyen únicamente reservas completadas.</p><div className="fs-metrics">{[
      ['Solicitudes pendientes',metrics.bookings.pending],['Reservas confirmadas',metrics.bookings.confirmed],['Reservas completadas',metrics.bookings.completed],['Ingresos CLP',metrics.bookings.revenue],['Turnos pendientes',metrics.queue.pending],['Turnos llamados',metrics.queue.called],['Turnos finalizados',metrics.queue.completed],['Espera promedio (min)',metrics.queue.averageWaitMinutes],['Atención promedio (min)',metrics.queue.averageServiceMinutes],
    ].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section><section className="fs-card"><h2>Atajos</h2><div className="fs-actions"><a href="#/academic/queue">Gestionar turnos</a><a href="#/academic/services">Administrar servicios</a><a href="#/academic/history">Consultar historial</a><a href="/api/docs" target="_blank" rel="noreferrer">Abrir Swagger</a></div></section></>
  }
  return <AdminLayout activeSection={activeSection} navigationKey={navigationKey} onNavigate={onNavigate}>
    <div className="admin-page fs-page"><header className="admin-page__heading"><div><p className="eyebrow">BarberBook · Hito 3</p><h1>{titles[activeSection]}</h1></div><button type="button" disabled={busy} onClick={refresh}>Actualizar datos</button></header>
      <nav className="fs-tabs" aria-label="Secciones de gestión">{['queue','history','services','settings','finances'].map((key) => <a key={key} href={`#/${academic?'academic':'panel'}/${key}`} aria-current={activeSection === key ? 'page' : undefined}>{titles[key]}</a>)}</nav>
      {loading && <p role="status">Cargando datos del servidor…</p>}
      {error && <div className="fs-error" role="alert">{error}</div>}
      {message && <p className="fs-success" role="status">{message}</p>}
      {busy && <p role="status">Guardando operación…</p>}
      {ready && <fieldset className="fs-content" disabled={busy} aria-busy={busy}>{section()}</fieldset>}
      {!loading && !ready && <p>No pudimos cargar la información necesaria. Usa «Actualizar datos» para reintentar.</p>}
    </div>
  </AdminLayout>
}

function BlockManager({ data,run }) {
  const [form,setForm] = useState({ professionalId: data.professionals[0]?.id || '',dateId: '',time: '',duration: 60 })
  return <section className="fs-card"><h2>Bloqueos puntuales</h2><form className="fs-form" onSubmit={(event) => { event.preventDefault(); run(() => api('/availability/blocks',{ method: 'POST',body: form }),'Bloqueo registrado.') }}>
    <label>Profesional del bloqueo<select required value={form.professionalId} onChange={(event) => setForm({ ...form,professionalId: event.target.value })}>{data.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Fecha del bloqueo<input required type="date" value={form.dateId} onChange={(event) => setForm({ ...form,dateId: event.target.value })} /></label><label>Hora del bloqueo<input required type="time" value={form.time} onChange={(event) => setForm({ ...form,time: event.target.value })} /></label><label>Minutos de bloqueo<input required type="number" min="5" max="480" value={form.duration} onChange={(event) => setForm({ ...form,duration: Number(event.target.value) })} /></label><button type="submit">Bloquear intervalo</button>
    </form>{!data.blocks.length && <p>No hay bloqueos.</p>}{data.blocks.map((block) => <div className="fs-row" key={block.id}><span>{data.professionals.find((p) => p.id === block.professionalId)?.name} · {new Date(block.startsAt).toLocaleString('es-CL')}</span><button type="button" onClick={() => run(() => api(`/availability/blocks/${block.id}`,{ method: 'DELETE' }),'Bloqueo retirado.')}>Retirar bloqueo</button></div>)}</section>
}
