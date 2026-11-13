// Adaptado del ProfileHero del Taller 2. Solo muestra datos del contrato actual.
export default function ProfileHero({ professional, services, onBook }) {
  const initial = professional.name.trim().charAt(0).toUpperCase();
  const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const schedule = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const intervals = (professional.working_hours ?? []).filter((item) => item.weekday === day);
    return { day, hours: intervals.map((item) => `${formatTime(item.startMinute)}–${formatTime(item.endMinute)}`).join(' · ') };
  }).filter((item) => item.hours);
  const groups = [];
  for (const item of schedule) {
    const group = groups.find((entry) => entry.hours === item.hours);
    if (group) group.days.push(weekdays[item.day]);
    else groups.push({ hours: item.hours, days: [weekdays[item.day]] });
  }
  return (
    <section className="profile-hero" aria-labelledby="professional-name">
      <div className="container">
        <div className="profile-hero__cover">
          <div className="profile-hero__cover-fallback" aria-hidden="true"><span>{initial}</span></div>
          <span className="profile-hero__cover-label">Trabajo con identidad</span>
        </div>
        <article className="profile-card">
          <div className="profile-avatar" aria-hidden="true"><span>{initial}</span></div>
          <div className="profile-card__identity">
            <p className="eyebrow">Perfil profesional</p>
            <h1 id="professional-name">{professional.name}</h1>
            {professional.title && <p className="profile-card__title">{professional.title}</p>}
            {professional.bio && <p className="profile-card__bio">{professional.bio}</p>}
            {professional.specialties?.length > 0 && <ul className="profile-specialties" aria-label="Especialidades">{professional.specialties.map((item) => <li key={item}>{item}</li>)}</ul>}
            {services.length > 0 && <ul className="profile-specialties" aria-label="Servicios del profesional">
              {services.map((service) => <li key={service.id}>{service.name}</li>)}
            </ul>}
            <div className="profile-card__facts">
              {professional.location && <div className="profile-fact"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></svg><div><span>Ubicación</span><strong>{professional.location}</strong></div></div>}
              <div className="profile-fact">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <div><span>Horario general · hora de Chile</span>
                  {groups.length ? groups.map((group) => <strong key={group.hours}>{group.days.join(', ')} · {group.hours}</strong>)
                    : <strong>Sin jornada publicada</strong>}
                </div>
              </div>
            </div>
          </div>
          <div className="profile-card__actions">
            {(professional.instagram || professional.whatsapp) && <div className="profile-social-links">
              {professional.instagram && <a href={`https://www.instagram.com/${professional.instagram.replace(/^@/, '')}/`} target="_blank" rel="noreferrer">Instagram <small>{professional.instagram}</small></a>}
              {professional.whatsapp && <a href={`https://wa.me/${professional.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp <small>{professional.whatsapp}</small></a>}
            </div>}
            <button className="button button--primary booking-cta" type="button" onClick={() => onBook()} disabled={!services.length}>
              <span className="booking-cta__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14v15H5Z" /><path d="m9 14 2 2 4-4" /></svg>
              </span>
              <span className="booking-cta__copy"><strong>Reservar ahora</strong><small>Elige servicio, fecha y hora</small></span>
              <svg className="booking-cta__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" /></svg>
            </button>
            <p className="booking-assurance"><span aria-hidden="true">✓</span> Reserva gratuita. El servicio se paga directamente en la barbería.</p>
            {!services.length && <p role="status">Este profesional aún no tiene servicios publicados.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
