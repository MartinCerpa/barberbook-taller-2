import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';
import BookingForm from '../components/BookingForm';
import ProfileHero from '../components/public/ProfileHero';
import { obtenerProfesionales, obtenerServicios } from '../services/api';

export default function PublicBarberPage() {
  const [catalog, setCatalog] = useState({ people: [], services: [] });
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [isBooking, setIsBooking] = useState(() => window.location.hash === '#reserva');

  useEffect(() => {
    const update = () => { setIsBooking(window.location.hash === '#reserva'); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => Promise.all([obtenerProfesionales(controller.signal), obtenerServicios(controller.signal)])
      .then(([people, services]) => {
        if (!controller.signal.aborted) { setCatalog({ people, services }); setError(''); }
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const refresh = () => { if (window.location.hash !== '#reserva') load(); };
    load();
    window.addEventListener('focus', refresh);
    window.addEventListener('hashchange', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('hashchange', refresh); };
  }, [revision]);

  const professional = catalog.people.find((person) => String(person.id) === selectedId) ?? catalog.people[0];
  const services = professional ? catalog.services.filter((service) => service.professionalId === professional.id) : [];
  function startBooking() {
    if (!services.length) return;
    window.location.hash = 'reserva';
  }
  function retry() { setLoading(true); setError(''); setRevision((value) => value + 1); }
  const exit = () => { window.location.hash = 'inicio'; };

  return <div className="site-shell">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="site-header"><div className="container site-header__content">
      <Brand /><div className="site-header__actions"><a className="professional-access" aria-label="Panel profesional" href="#/panel/dashboard">Panel<span className="professional-access__suffix"> profesional</span></a><ThemeToggle /></div>
    </div></header>
    <main id="contenido">
      {loading && <div className="container catalog-status" role="status">Cargando perfil y servicios…</div>}
      {!loading && error && <div className="container catalog-status" role="alert"><h1>No pudimos cargar el perfil</h1><p>{error}</p><button className="button button--secondary" onClick={retry}>Reintentar</button></div>}
      {!loading && !error && !professional && <div className="container catalog-status" role="status"><h1>Sin profesionales publicados</h1><p>Vuelve más tarde para consultar los servicios.</p></div>}
      {!loading && !error && professional && (isBooking
        ? <BookingForm key={professional.id} professionalId={professional.id} automaticApproval={professional.automatic_approval} servicios={services} onExit={exit} />
        : <>
          {catalog.people.length > 1 && <div className="container professional-picker form-field"><label htmlFor="professional">Profesional</label>
            <select id="professional" value={professional.id} onChange={(event) => setSelectedId(event.target.value)}>
              {catalog.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select></div>}
          <ProfileHero professional={professional} services={services} onBook={startBooking} />
          {services.length > 0 && <div className="mobile-booking-bar"><button type="button" onClick={() => startBooking()}>Reservar ahora <span aria-hidden="true">→</span></button></div>}
        </>)}
    </main>
    <footer className="site-footer"><div className="container site-footer__content"><Brand /><p>Tu estilo, tu tiempo.</p></div></footer>
  </div>;
}
