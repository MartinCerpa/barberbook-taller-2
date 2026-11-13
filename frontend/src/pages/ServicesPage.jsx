import { useState } from 'react';
import { obtenerServiciosPrivados, guardarServicio } from '../services/professionalApi';
import useProfessionalResource from '../hooks/useProfessionalResource';
import ServiceCard from '../components/admin/ServiceCard';
import SettingsBackButton from '../components/admin/SettingsBackButton';
import ResourceState from '../components/admin/ResourceState';

export default function ServicesPage({ onBack, professional, onSessionExpired }) {
  const resource = useProfessionalResource(obtenerServiciosPrivados, onSessionExpired);
  const [newService, setNewService] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  async function save(id, body) {
    if (busy) return false;
    setBusy(true); setFeedback(null);
    try {
      await guardarServicio(id, body, professional.csrfToken);
      if (!await resource.reload()) return false;
      if (!id) setNewService(false);
      setFeedback({ type: 'success', message: 'Servicio guardado en PostgreSQL.' }); return true;
    } catch (cause) { if (cause.status === 401) onSessionExpired(); setFeedback({ type: 'error', message: cause.message }); return false; }
    finally { setBusy(false); }
  }
  return <div className="admin-page services-page" data-embedded="true"><SettingsBackButton onBack={onBack} />
    <header className="admin-page__heading services-page__heading"><div><p className="eyebrow">Oferta profesional</p><h1>Servicios</h1><p>Administra lo que ofreces y cómo lo ven tus clientes.</p></div><button className="button button--primary" type="button" disabled={busy || newService || !resource.data} onClick={() => setNewService(true)}>Agregar servicio</button></header>
    <ResourceState {...resource} onRetry={resource.reload} />
    {resource.data && !resource.error && <>
      <section className="services-summary" aria-label="Resumen de servicios"><div><strong>{resource.data.length}</strong><span>Total</span></div><div><strong>{resource.data.filter((s) => s.active).length}</strong><span>Activos</span></div><div><strong>{resource.data.filter((s) => !s.active).length}</strong><span>Inactivos</span></div></section>
      <div className="services-page__feedback" aria-live="polite">{feedback && <p data-type={feedback.type} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}</div>
      <section className="services-list" aria-label="Servicios administrables">{newService && <ServiceCard service={{ name: '', duration_minutes: '', price: '', active: true }} onSave={save} busy={busy} onDiscard={() => setNewService(false)} />}
        {resource.data.map((service) => <ServiceCard key={`${service.id}:${service.name}:${service.duration_minutes}:${service.price}:${service.active}`} service={service} onSave={save} busy={busy} />)}
      </section>
    </>}
  </div>;
}
