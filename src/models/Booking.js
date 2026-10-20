/**
 * Booking request connecting a customer with a service and time slot.
 */
export class Booking {
  constructor({
    id = null,
    serviceId = '',
    customerId = null,
    customer = null,
    dateId = '',
    date = '',
    time = '',
    status = 'pending',
    duration = null,
    createdAt = null,
    expiresAt = null,
    confirmationOrigin = 'manual',
    isLateCancellation = false,
  } = {}) {
    this.id = id
    this.serviceId = serviceId
    this.customerId = customerId
    this.customer = customer ? { ...customer } : null
    this.dateId = dateId
    this.date = date
    this.time = time
    this.status = status
    this.duration = duration
    this.createdAt = createdAt
    this.expiresAt = expiresAt
    this.confirmationOrigin = confirmationOrigin
    this.isLateCancellation = isLateCancellation
  }
}
