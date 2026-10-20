import { services as baseServices } from '../data/services.js'

export const SERVICE_PREFERENCES_STORAGE_KEY = 'barberbook-taller-2:services:v1'

const baseServiceIds = new Set(baseServices.map((service) => service.id))
const editableBooleanFields = [
  'active',
  'publicVisible',
  'publicPriceVisible',
]

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const isPlainObject = (value) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const normalizeName = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const name = value.trim()
  return name && name.length <= 80 ? name : null
}

const normalizeDescription = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, 240)
}

const normalizeDuration = (value) =>
  Number.isInteger(value) && value >= 5 && value <= 480 ? value : null

const normalizePrice = (value) =>
  Number.isInteger(value) && value >= 0 && value <= 100000000 ? value : null

const sanitizeOverride = (value) => {
  if (!isPlainObject(value)) {
    return null
  }

  const override = {}
  const name = normalizeName(value.name)
  const duration = normalizeDuration(value.duration)
  const price = normalizePrice(value.price)

  if (name) {
    override.name = name
  }

  if (duration !== null) {
    override.duration = duration
  }

  if (price !== null) {
    override.price = price
  }

  editableBooleanFields.forEach((field) => {
    if (typeof value[field] === 'boolean') {
      override[field] = value[field]
    }
  })

  return Object.keys(override).length ? override : null
}

const sanitizeCustomService = (value) => {
  if (!isPlainObject(value)) {
    return null
  }

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const name = normalizeName(value.name)
  const duration = normalizeDuration(value.duration)
  const price = normalizePrice(value.price)

  if (
    !id.startsWith('local-service-') ||
    id.length > 120 ||
    baseServiceIds.has(id) ||
    !name ||
    duration === null ||
    price === null
  ) {
    return null
  }

  return {
    id,
    name,
    description: normalizeDescription(value.description),
    duration,
    price,
    active: typeof value.active === 'boolean' ? value.active : true,
    publicVisible:
      typeof value.publicVisible === 'boolean' ? value.publicVisible : false,
    publicPriceVisible:
      typeof value.publicPriceVisible === 'boolean'
        ? value.publicPriceVisible
        : false,
  }
}

export const sanitizeServicePreferences = (value) => {
  if (!isPlainObject(value)) {
    return null
  }

  const overrides = {}

  if (isPlainObject(value.overrides)) {
    Object.entries(value.overrides).forEach(([serviceId, overrideValue]) => {
      if (!baseServiceIds.has(serviceId)) {
        return
      }

      const override = sanitizeOverride(overrideValue)

      if (override) {
        overrides[serviceId] = override
      }
    })
  }

  const customServices = []
  const seenIds = new Set()

  if (Array.isArray(value.customServices)) {
    value.customServices.forEach((serviceValue) => {
      const service = sanitizeCustomService(serviceValue)

      if (!service || seenIds.has(service.id)) {
        return
      }

      seenIds.add(service.id)
      customServices.push(service)
    })
  }

  return { overrides, customServices }
}

export const getServicePreferences = () => {
  const storage = getStorage()

  if (!storage) {
    return null
  }

  try {
    const storedValue = storage.getItem(SERVICE_PREFERENCES_STORAGE_KEY)

    if (!storedValue) {
      return null
    }

    return sanitizeServicePreferences(JSON.parse(storedValue))
  } catch {
    return null
  }
}

export const saveServicePreferences = (value) => {
  const storage = getStorage()
  const preferences = sanitizeServicePreferences(value)

  if (!storage || !preferences) {
    return { success: false, preferences: null }
  }

  try {
    storage.setItem(
      SERVICE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )

    return { success: true, preferences }
  } catch {
    return { success: false, preferences: null }
  }
}

export const clearServicePreferences = () => {
  const storage = getStorage()

  if (!storage) {
    return false
  }

  try {
    storage.removeItem(SERVICE_PREFERENCES_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
