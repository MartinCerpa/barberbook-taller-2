import { useState } from 'react'

function PortfolioCard({ item, index }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)

  return (
    <article
      className="portfolio-card"
      data-portfolio-tone={(index % 3) + 1}
      data-reveal
      data-reveal-order={String(Math.min(index + 2, 5))}
    >
      <div className="portfolio-card__media">
        <div className="portfolio-card__fallback" aria-hidden="true">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <small>Trabajo destacado</small>
        </div>
        {item.image && !imageUnavailable && (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            onError={() => setImageUnavailable(true)}
          />
        )}
        <span className="portfolio-card__number" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="portfolio-card__content">
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
      </div>
    </article>
  )
}

function PortfolioSection({ items, professionalName }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="portfolio-section" aria-labelledby="portfolio-title">
      <div className="container">
        <div className="portfolio-section__heading" data-reveal>
          <div>
            <p className="eyebrow">Portafolio</p>
            <h2 id="portfolio-title">Trabajos destacados</h2>
          </div>
          <p>
            Una selección del estilo y la precisión que {professionalName} lleva
            a cada trabajo.
          </p>
        </div>

        <div className="portfolio-grid">
          {items.map((item, index) => (
            <PortfolioCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PortfolioSection
