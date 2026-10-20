function LocationLink({ location, mapsUrl }) {
  return (
    <a
      className="location-link"
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir ${location} en Google Maps`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <span>{location}</span>
      <span className="location-link__action">Ver en Maps</span>
      <svg className="location-link__arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  )
}

export default LocationLink
