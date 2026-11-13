import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function ServiceCard({ service, onSave, onDiscard, busy }) {
  const [editing, setEditing] = useState(!service.id);
  const [draft, setDraft] = useState(service);
  const change = (key, value) => setDraft((s) => ({ ...s, [key]: value }));
  return <article className={`service-card${service.active ? '' : ' is-inactive'}${editing ? ' is-editing' : ''}`} aria-busy={busy}>
    <header className="service-card__heading"><div><span>Servicio profesional</span><h2>{service.name || 'Nuevo servicio'}</h2></div>
      <button type="button" disabled={busy} aria-expanded={editing} onClick={() => { setDraft(service); setEditing((v) => !v); }}>{editing ? 'Cerrar' : 'Editar'}</button></header>
    <div className="service-card__details" aria-label="Detalle del servicio"><span><small>Duración</small><strong>{service.duration_minutes || '—'} min</strong></span><span><small>Precio</small><strong>{formatCurrency(service.price)}</strong></span></div>
    <div className="service-card__states"><button className="service-card__state" type="button" data-state={service.active ? 'active' : 'inactive'} aria-pressed={service.active} disabled={busy || !service.id}
      onClick={() => onSave(service.id, { active: !service.active })}>{service.active ? 'Disponible' : 'No disponible'}</button></div>
    {editing && <form className="service-card__editor" onSubmit={async (e) => {
      e.preventDefault(); if (await onSave(service.id, { name: draft.name, duration_minutes: Number(draft.duration_minutes), price: Number(draft.price), active: draft.active })) setEditing(false);
    }}>
      <fieldset className="panel-form-fields" disabled={busy}>
        <div className="service-card__fields">
          <label className="service-field service-field--wide"><span>Nombre del servicio</span><input required maxLength={100} value={draft.name} onChange={(e) => change('name', e.target.value)} /></label>
          <label className="service-field"><span>Duración en minutos</span><input type="number" required min={5} max={480} step={5} value={draft.duration_minutes} onChange={(e) => change('duration_minutes', e.target.value)} /></label>
          <label className="service-field"><span>Precio</span><div className="service-field__price"><span aria-hidden="true">$</span><input type="number" required min={0} max={100000000} step={1} value={draft.price} onChange={(e) => change('price', e.target.value)} /></div></label>
        </div>
        <div className="service-card__toggles"><label className="service-toggle"><span><strong>Disponible para reservas</strong><small>Puede elegirse al solicitar una hora.</small></span><input type="checkbox" role="switch" checked={draft.active} onChange={(e) => change('active', e.target.checked)} /><span className="service-toggle__control" aria-hidden="true" /></label></div>
      </fieldset>
      <div className="service-card__editor-actions"><small>Desactivar conserva las reservas y su historial.</small><div className="service-card__save-actions"><button type="button" disabled={busy} onClick={() => { setDraft(service); setEditing(false); onDiscard?.(); }}>Descartar cambios</button><button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div></div>
    </form>}
  </article>;
}
