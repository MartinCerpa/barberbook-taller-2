/**
 * Contact information used to identify a booking customer.
 */
export class Customer {
  constructor({ id = null, name = '', phone = '', email = '' } = {}) {
    this.id = id
    this.name = name
    this.phone = phone
    this.email = email
  }
}
