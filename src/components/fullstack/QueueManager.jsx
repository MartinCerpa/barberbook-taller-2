import { useRef, useState } from 'react'
import { api } from '../../services/api.js'
import { stateLabels } from '../../utils/stateLabels.js'

export default function QueueManager({ data,run }) {
  const [branchId,setBranch] = useState(data.branches.find((b) => b.active)?.id || '')
  const [serviceId,setService] = useState('')
  const [moduleId,setModule] = useState('')
  const [customer,setCustomer] = useState({ name: '',phone: '' })
  const requestId = useRef(null)
  const submit = async (event) => {
    event.preventDefault()
    requestId.current ??= crypto.randomUUID()
    const ok = await run(() => api('/tickets',{ method: 'POST',body: { id: requestId.current,branchId,serviceId,customer } }),'Turno emitido y persistido.')
    if (ok) { requestId.current = null; setCustomer({ name: '',phone: '' }) }
  }
  const tickets = data.tickets.filter((t) => t.branchId === branchId)
  const change = (setter,value) => { requestId.current = null; setter(value) }
  return <>
    <section className="fs-card">
      <h2>Turnos presenciales</h2><p>La fila atiende por orden de emisión. Las reservas anticipadas mantienen su horario y tienen prioridad sobre un llamado incompatible.</p>
      <label className="fs-field">Sucursal<select aria-label="Sucursal de turnos" value={branchId} onChange={(event) => { change(setBranch,event.target.value); setService(''); setModule('') }}><option value="">Selecciona…</option>{data.branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <form className="fs-form" onSubmit={submit}>
        <label>Servicio del turno<select required value={serviceId} onChange={(event) => change(setService,event.target.value)}><option value="">Selecciona…</option>{data.services.filter((s) => s.active && s.branchId === branchId).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration} min</option>)}</select></label>
        <label>Nombre ficticio<input required minLength={2} maxLength={100} value={customer.name} onChange={(event) => change(setCustomer,{ ...customer,name: event.target.value })} /></label>
        <label>Teléfono ficticio<input required type="tel" placeholder="+56900000001" value={customer.phone} onChange={(event) => change(setCustomer,{ ...customer,phone: event.target.value })} /></label>
        <button type="submit" className="button button--primary">Emitir turno</button>
      </form>
      <div className="fs-actions"><label className="fs-field">Módulo<select aria-label="Módulo para llamar" value={moduleId} onChange={(event) => setModule(event.target.value)}><option value="">Selecciona…</option>{data.modules.filter((m) => m.active && m.branchId === branchId && data.professionals.some((p) => p.id === m.professionalId && p.active)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button type="button" disabled={!moduleId} onClick={() => run(() => api('/tickets/next',{ method: 'POST',body: { moduleId } }),'Siguiente turno llamado y asignado.')}>Llamar siguiente</button></div>
    </section>
    <section className="fs-card"><h2>Fila e historial reciente</h2>{!tickets.length && <p>No hay turnos en esta sucursal.</p>}
      {tickets.map((ticket) => <article className="fs-row" key={ticket.id}>
        <div><strong>Turno {ticket.number} · {ticket.customerName}</strong><p>{ticket.service} · {stateLabels[ticket.status]}</p><small>Espera: {Number(ticket.waitMinutes).toFixed(1)} min{ticket.moduleName ? ` · ${ticket.moduleName} · ${ticket.professionalName}` : ''}</small></div>
        {ticket.status === 'called' && <button type="button" onClick={() => run(() => api(`/tickets/${ticket.id}/status`,{ method: 'PATCH',body: { status: 'completed' } }),'Atención finalizada.')}>Finalizar turno {ticket.number}</button>}
        {ticket.status === 'pending' && <button type="button" onClick={() => run(() => api(`/tickets/${ticket.id}/status`,{ method: 'PATCH',body: { status: 'cancelled' } }),'Turno cancelado.')}>Cancelar turno {ticket.number}</button>}
      </article>)}
    </section>
  </>
}
