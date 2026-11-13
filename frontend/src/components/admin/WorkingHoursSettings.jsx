import { useState } from 'react';
import useProfessionalResource from '../../hooks/useProfessionalResource';
import { obtenerJornada, guardarJornada } from '../../services/professionalApi';
import SettingsBackButton from './SettingsBackButton';
import ResourceState from './ResourceState';

const week = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
function HoursForm({ initial, csrf, onSessionExpired }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const update = (id, action) => { setDraft((d) => ({ days: d.days.map((day) => day.day === id ? action(day) : day) })); setFeedback(null); };
  function interval(id, index, key, value) { update(id, (day) => ({ ...day, intervals: day.intervals.map((v, i) => i === index ? { ...v, [key]: value } : v) })); }
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setFeedback(null);
    try {
      // Un día deshabilitado se representa por ausencia de intervalos en SQL.
      const saved = await guardarJornada({ days: draft.days.map((d) => ({ ...d, intervals: d.enabled ? d.intervals : [] })) }, csrf);
      setDraft(saved); setFeedback({ type: 'success', message: 'Horario actualizado en PostgreSQL y en la disponibilidad pública.' });
    } catch (cause) { if (cause.status === 401) onSessionExpired(); setFeedback({ type: 'error', message: cause.message }); }
    finally { setBusy(false); }
  }
  return <form className="working-hours" onSubmit={save}>
    <p className="working-hours__note">Las horas de inicio se ofrecen cada 60 minutos desde el inicio de cada intervalo. Guarda al terminar de editar.</p>
    <fieldset className="panel-form-fields" disabled={busy}><div className="working-hours__days">
      {week.map(([id, label]) => { const day = draft.days.find((d) => d.day === id); return <section className="working-hours__day" aria-labelledby={`working-day-${id}`} key={id}>
        <header><h2 id={`working-day-${id}`}>{label}</h2><button className="working-hours__toggle" type="button" role="switch" aria-checked={day.enabled} aria-label={`${label} activo`} onClick={() => update(id, (d) => ({ ...d, enabled: !d.enabled }))}><span aria-hidden="true" />{day.enabled ? 'Activo' : 'Cerrado'}</button></header>
        {day.enabled ? <><div className="working-hours__intervals">{day.intervals.map((v, i) => <div className="working-hours__interval" key={i}>
          <label><span>Desde</span><input type="time" required step={60} aria-label={`${label}, inicio ${i + 1}`} value={v.start} onChange={(e) => interval(id, i, 'start', e.target.value)} /></label><span className="working-hours__separator" aria-hidden="true">—</span>
          <label><span>Hasta</span><input type="time" required step={60} aria-label={`${label}, término ${i + 1}`} value={v.end} onChange={(e) => interval(id, i, 'end', e.target.value)} /></label>
          <button className="working-hours__remove" type="button" aria-label={`Eliminar intervalo ${i + 1} de ${label}`} onClick={() => update(id, (d) => ({ ...d, intervals: d.intervals.filter((_, n) => n !== i) }))}>×</button>
        </div>)}</div><button className="working-hours__add" type="button" disabled={day.intervals.length >= 4} onClick={() => update(id, (d) => ({ ...d, intervals: [...d.intervals, { start: '', end: '' }] }))}>Agregar intervalo<span className="sr-only"> a {label}</span></button></>
          : <p className="working-hours__closed">No se ofrecen nuevas reservas este día.</p>}
      </section>; })}
    </div></fieldset>
    {feedback && <p className="panel-save-feedback" data-type={feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
    <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar horario'}</button>
  </form>;
}

export default function WorkingHoursSettings({ onBack, professional, onSessionExpired }) {
  const resource = useProfessionalResource(obtenerJornada, onSessionExpired);
  return <div className="admin-page settings-page settings-subview working-hours-page"><SettingsBackButton onBack={onBack} />
    <header className="admin-page__heading"><div><p className="eyebrow">Tu semana habitual</p><h1>Horarios de atención</h1><p>Define cuándo trabajas y sus pausas. La jornada protege las reservas confirmadas existentes.</p></div></header>
    <ResourceState {...resource} onRetry={resource.reload} />
    {resource.data && !resource.error && <HoursForm initial={resource.data} csrf={professional.csrfToken} onSessionExpired={onSessionExpired} />}
  </div>;
}
