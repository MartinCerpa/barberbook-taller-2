/**
 * Public information and operating details for a business.
 */
export class Business {
  constructor({ id = null, name = '', location = '', mapsUrl = '', openingHours = {} } = {}) {
    this.id = id
    this.name = name
    this.location = location
    this.mapsUrl = mapsUrl
    this.openingHours = { ...openingHours }
  }
}
