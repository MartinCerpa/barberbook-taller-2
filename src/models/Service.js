/**
 * Service offered by a professional or business.
 */
export class Service {
  constructor({
    id = '',
    name = '',
    description = '',
    price = 0,
    duration = 0,
    active = true,
    publicVisible = false,
    publicPriceVisible = false,
  } = {}) {
    this.id = id
    this.name = name
    this.description = description
    this.price = price
    this.duration = duration
    this.active = active
    this.publicVisible = publicVisible
    this.publicPriceVisible = publicPriceVisible
  }
}
