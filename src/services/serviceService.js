import { services } from '../data/services.js'
import {
  clearServicePreferences,
  getServicePreferences,
  saveServicePreferences,
} from './servicePreferencesService.js'

const editableFields = [
  'name',
  'duration',
  'price',
  'active',
  'publicVisible',
  'publicPriceVisible',
]
const baseServiceIds = new Set(services.map((service) => service.id))

const copyService = (service) => ({ ...service })

export const getEffectiveServices = () => {
  const preferences = getServicePreferences()
  const overrides = preferences?.overrides ?? {}
  const base = services.map((service) => ({
    ...service,
    ...overrides[service.id],
    isCustom: false,
  }))
  const custom = (preferences?.customServices ?? []).map((service) => ({
    ...service,
    isCustom: true,
  }))

  return [...base, ...custom]
}

const validateService = (service) => {
  const name = typeof service.name === 'string' ? service.name.trim() : ''
  const duration = Number(service.duration)
  const price = Number(service.price)

  if (!name || name.length > 80) {
    return 'Ingresa un nombre de hasta 80 caracteres.'
  }

  if (
    service.duration === '' ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 480
  ) {
    return 'La duración debe estar entre 5 y 480 minutos.'
  }

  if (
    service.price === '' ||
    !Number.isInteger(price) ||
    price < 0 ||
    price > 100000000
  ) {
    return 'Ingresa un precio válido.'
  }

  return null
}

const normalizeEditableService = (service) => ({
  ...service,
  name: service.name.trim(),
  duration: Number(service.duration),
  price: Number(service.price),
  active: Boolean(service.active),
  publicVisible: Boolean(service.publicVisible),
  publicPriceVisible: Boolean(service.publicPriceVisible),
})

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `local-service-${crypto.randomUUID()}`
  }

  return `local-service-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

export const getServices = async () => getEffectiveServices().map(copyService)

export const getActiveServices = async () =>
  getEffectiveServices().filter((service) => service.active).map(copyService)

export const getPublicServices = async () =>
  getEffectiveServices()
    .filter((service) => service.active && service.publicVisible)
    .map(copyService)

export const getServiceById = async (serviceId) => {
  const service = getEffectiveServices().find((item) => item.id === serviceId)
  return service ? copyService(service) : null
}

export const createLocalService = () => ({
  id: createLocalId(),
  name: '',
  description: '',
  duration: 30,
  price: 0,
  active: true,
  publicVisible: false,
  publicPriceVisible: false,
  isCustom: true,
})

export const saveServices = async (nextServices) => {
  if (!Array.isArray(nextServices)) {
    return { success: false, services: await getServices() }
  }

  const errors = {}
  const seenIds = new Set()

  nextServices.forEach((service, index) => {
    const serviceId = typeof service.id === 'string' ? service.id : ''

    if (
      !serviceId ||
      seenIds.has(serviceId) ||
      (!baseServiceIds.has(serviceId) && !serviceId.startsWith('local-service-'))
    ) {
      errors[serviceId || `service-${index}`] =
        'El identificador del servicio no es válido.'
      return
    }

    seenIds.add(serviceId)
    const error = validateService(service)

    if (error) {
      errors[serviceId] = error
    }
  })

  if (Object.keys(errors).length) {
    return { success: false, services: nextServices, errors }
  }

  const normalizedServices = nextServices.map(normalizeEditableService)
  const overrides = {}

  services.forEach((baseService) => {
    const currentService = normalizedServices.find(
      (service) => service.id === baseService.id,
    )

    if (!currentService) {
      return
    }

    const override = {}

    editableFields.forEach((field) => {
      if (currentService[field] !== baseService[field]) {
        override[field] = currentService[field]
      }
    })

    if (Object.keys(override).length) {
      overrides[baseService.id] = override
    }
  })

  const customServices = normalizedServices
    .filter((service) => !baseServiceIds.has(service.id))
    .map(({ isCustom: _isCustom, ...service }) => service)

  const hasPreferences =
    Object.keys(overrides).length > 0 || customServices.length > 0
  const saved = hasPreferences
    ? saveServicePreferences({ overrides, customServices })
    : { success: clearServicePreferences(), preferences: null }

  if (!saved.success) {
    return { success: false, services: nextServices }
  }

  return { success: true, services: await getServices(), errors: {} }
}

export const restoreOriginalServices = async () => {
  const success = clearServicePreferences()

  return {
    success,
    services: success ? await getServices() : null,
  }
}

export const serviceService = {
  getServices,
  getActiveServices,
  getPublicServices,
  getServiceById,
  createLocalService,
  saveServices,
  restoreOriginalServices,
}
