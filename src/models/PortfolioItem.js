/**
 * Representa un trabajo destacado dentro del portafolio de un profesional.
 */
export class PortfolioItem {
  constructor({
    id = '',
    professionalId = '',
    image = '',
    title = '',
    description = '',
    featured = false,
  } = {}) {
    this.id = id
    this.professionalId = professionalId
    this.image = image
    this.title = title
    this.description = description
    this.featured = featured
  }
}
