import { useState } from 'react'
import LocationLink from '../LocationLink'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6Z" />
      <path d="M9 8.5c.4 2.4 2.1 4.1 4.5 4.8M13.5 13.3l1.1-1.1M9 8.5l.9-.8" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

const getInstagramUrl = (instagram) => {
  if (instagram.startsWith('http://') || instagram.startsWith('https://')) {
    return instagram
  }

  return `https://www.instagram.com/${instagram.replace(/^@/, '')}`
}

const getWhatsAppUrl = (whatsapp) =>
  `https://wa.me/${whatsapp.replace(/\D/g, '')}`

function ProfileHero({ business, professional, onBook, primaryCtaRef }) {
  const [coverUnavailable, setCoverUnavailable] = useState(false)
  const [profileUnavailable, setProfileUnavailable] = useState(false)
  const initial = professional.name.trim().charAt(0)
  const location = professional.location || business.location

  return (
    <section className="profile-hero" id="inicio">
      <div className="container">
        <div
          className={`profile-hero__cover${coverUnavailable ? ' is-fallback' : ''}`}
          data-reveal
          data-reveal-order="1"
        >
          <div className="profile-hero__cover-fallback" aria-hidden="true">
            <span>{initial}</span>
          </div>
          {professional.coverImage && !coverUnavailable && (
            <img
              src={professional.coverImage}
              alt=""
              onError={() => setCoverUnavailable(true)}
            />
          )}
          <span className="profile-hero__cover-label">Trabajo con identidad</span>
        </div>

        <article className="profile-card" aria-labelledby="professional-name">
          <div
            className={`profile-avatar${profileUnavailable ? ' is-fallback' : ''}`}
            data-reveal
            data-reveal-order="2"
          >
            <span aria-hidden="true">{initial}</span>
            {professional.profileImage && !profileUnavailable && (
              <img
                src={professional.profileImage}
                alt={`Retrato de ${professional.name}`}
                onError={() => setProfileUnavailable(true)}
              />
            )}
          </div>

          <div className="profile-card__identity">
            <p className="eyebrow" data-reveal data-reveal-order="2">
              Perfil profesional
            </p>
            <h1 id="professional-name" data-reveal data-reveal-order="3">
              {professional.name}
            </h1>
            <p
              className="profile-card__title"
              data-reveal
              data-reveal-order="3"
            >
              {professional.title || professional.role}
            </p>
            <p
              className="profile-card__bio"
              data-reveal
              data-reveal-order="4"
            >
              {professional.bio}
            </p>

            {professional.specialties.length > 0 && (
              <ul
                className="profile-specialties"
                aria-label="Especialidades"
                data-reveal
                data-reveal-order="5"
              >
                {professional.specialties.map((specialty) => (
                  <li key={specialty}>{specialty}</li>
                ))}
              </ul>
            )}

            <div className="profile-card__facts">
              <div
                className="profile-location"
                data-reveal
                data-reveal-order="6"
              >
                <LocationLink location={location} mapsUrl={business.mapsUrl} />
              </div>
              <div className="profile-fact" data-reveal data-reveal-order="7">
                <ClockIcon />
                <div>
                  <span>Horario general</span>
                  <strong>
                    {business.openingHours.days} · {business.openingHours.time}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-card__actions">
            <button
              className="button button--primary booking-cta"
              type="button"
              onClick={onBook}
              ref={primaryCtaRef}
              data-reveal
              data-reveal-order="4"
            >
              <span className="booking-cta__icon">
                <CalendarIcon />
              </span>
              <span className="booking-cta__copy">
                <strong>Reservar ahora</strong>
                <small>Elige servicio, fecha y hora</small>
              </span>
              <svg
                className="booking-cta__arrow"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M5 12h14M14 7l5 5-5 5" />
              </svg>
            </button>

            <p className="booking-assurance" data-reveal data-reveal-order="5">
              <span aria-hidden="true">✓</span>
              Reserva gratuita. El servicio se paga directamente en la barbería.
            </p>

            {(professional.instagram || professional.whatsapp) && (
              <div
                className="profile-social-links"
                data-reveal
                data-reveal-order="6"
              >
                {professional.instagram && (
                  <a
                    href={getInstagramUrl(professional.instagram)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ver Instagram de ${professional.name}`}
                  >
                    <InstagramIcon />
                    <span>
                      <small>Instagram</small>
                      <strong>{professional.instagram}</strong>
                    </span>
                  </a>
                )}
                {professional.whatsapp && (
                  <a
                    href={getWhatsAppUrl(professional.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Consultar a ${professional.name} por WhatsApp`}
                  >
                    <WhatsAppIcon />
                    <span>
                      <small>Contacto directo</small>
                      <strong>Consultar por WhatsApp</strong>
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

export default ProfileHero
