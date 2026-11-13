import { useState } from 'react';
import { obtenerPerfil, guardarPerfil } from '../../services/professionalApi';
import useProfessionalResource from '../../hooks/useProfessionalResource';
import SettingsBackButton from './SettingsBackButton';
import ResourceState from './ResourceState';

function ProfileForm({ initial, csrf, onSaved, onSessionExpired }) {
  const [draft, setDraft] = useState(() => ({ ...initial, bio: initial.bio ?? '' }));
  const [specialty, setSpecialty] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const field = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setFeedback(null); };
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setFeedback(null);
    try {
      const body = Object.fromEntries(['name', 'bio', 'title', 'specialties', 'location', 'instagram', 'whatsapp'].map((key) => [key, draft[key]]));
      const saved = await guardarPerfil(body, csrf); setDraft(saved); await onSaved();
      setFeedback({ type: 'success', message: 'Perfil guardado. Los cambios ya están disponibles en el perfil público.' });
    } catch (cause) { if (cause.status === 401) onSessionExpired(); setFeedback({ type: 'error', message: cause.message }); }
    finally { setBusy(false); }
  }
  function addSpecialty() {
    const next = specialty.trim(); if (!next || draft.specialties.includes(next)) return;
    field('specialties', [...draft.specialties, next]); setSpecialty('');
  }
  return <form className="profile-settings" onSubmit={save}>
    <fieldset className="panel-form-fields" disabled={busy}>
      <section className="profile-settings__section"><div className="profile-settings__section-heading"><span>01</span><div><h2>Identidad</h2><p>La presentación principal de tu perfil público.</p></div></div>
        <div className="profile-settings__fields profile-settings__fields--two-columns">
          <label className="profile-field"><span>Nombre profesional</span><input required maxLength={100} value={draft.name} onChange={(e) => field('name', e.target.value)} /></label>
          <label className="profile-field"><span>Título profesional</span><input maxLength={100} value={draft.title} onChange={(e) => field('title', e.target.value)} /></label>
        </div>
      </section>
      <section className="profile-settings__section"><div className="profile-settings__section-heading"><span>02</span><div><h2>Presentación</h2><p>Cuenta brevemente qué distingue tu trabajo.</p></div></div>
        <div className="profile-settings__fields"><label className="profile-field"><span>Biografía</span><textarea rows={4} maxLength={2000} value={draft.bio ?? ''} onChange={(e) => field('bio', e.target.value)} /><small>Esta descripción aparecerá en tu perfil público.</small></label>
          <div className="profile-field"><span id="specialties-label">Especialidades</span><div className="specialties-editor" aria-labelledby="specialties-label">
            {draft.specialties.length ? <ul className="specialties-editor__list">{draft.specialties.map((s) => <li key={s}><span>{s}</span><button type="button" aria-label={`Eliminar ${s}`} onClick={() => field('specialties', draft.specialties.filter((v) => v !== s))}>×</button></li>)}</ul> : <p className="specialties-editor__empty">Aún no agregas especialidades.</p>}
            <div className="specialties-editor__add"><input aria-label="Nueva especialidad" placeholder="Ej. Fade clásico" maxLength={60} value={specialty} onChange={(e) => setSpecialty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }} /><button type="button" disabled={!specialty.trim() || draft.specialties.length >= 8} onClick={addSpecialty}>Agregar</button></div>
          </div></div>
        </div>
      </section>
      <section className="profile-settings__section"><div className="profile-settings__section-heading"><span>03</span><div><h2>Contacto</h2><p>Información que tus clientes pueden consultar en el perfil.</p></div></div>
        <div className="profile-settings__fields profile-settings__fields--two-columns">
          <label className="profile-field profile-field--wide"><span>Ubicación</span><input maxLength={200} value={draft.location} onChange={(e) => field('location', e.target.value)} /></label>
          <label className="profile-field"><span>Instagram</span><input maxLength={31} placeholder="@usuario" value={draft.instagram} onChange={(e) => field('instagram', e.target.value)} /></label>
          <label className="profile-field"><span>WhatsApp</span><input type="tel" maxLength={30} value={draft.whatsapp} onChange={(e) => field('whatsapp', e.target.value)} /></label>
        </div>
      </section>
    </fieldset>
    {feedback && <p className="panel-save-feedback" data-type={feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
    <footer className="profile-settings__actions"><button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></footer>
  </form>;
}

export default function ProfileSettings({ onBack, professional, onSaved, onSessionExpired }) {
  const resource = useProfessionalResource(obtenerPerfil, onSessionExpired);
  return <div className="admin-page settings-page settings-subview"><SettingsBackButton onBack={onBack} />
    <header className="admin-page__heading"><div><p className="eyebrow">Identidad profesional</p><h1>Mi perfil</h1><p>Administra la información que ven tus clientes.</p></div></header>
    <ResourceState {...resource} onRetry={resource.reload} />
    {resource.data && !resource.error && <ProfileForm initial={resource.data} csrf={professional.csrfToken} onSaved={onSaved} onSessionExpired={onSessionExpired} />}
  </div>;
}
