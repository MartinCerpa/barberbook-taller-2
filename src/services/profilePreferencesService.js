import { usingApi,remoteSnapshot,remoteMutation } from './remoteState.js'
export const PROFILE_PREFERENCES_STORAGE_KEY =
  'barberbook-taller-2:professional-profile:v1'

const editableTextFields = [
  'name',
  'title',
  'bio',
  'location',
  'instagram',
  'whatsapp',
]

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const normalizeSpecialties = (specialties) => {
  if (!Array.isArray(specialties)) {
    return null
  }

  const normalized = []
  const seen = new Set()

  specialties.forEach((specialty) => {
    if (typeof specialty !== 'string') {
      return
    }

    const value = specialty.trim()
    const comparisonValue = value.toLocaleLowerCase('es-CL')

    if (!value || seen.has(comparisonValue)) {
      return
    }

    seen.add(comparisonValue)
    normalized.push(value)
  })

  return normalized
}

export const sanitizeProfilePreferences = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const preferences = {}

  editableTextFields.forEach((field) => {
    if (typeof value[field] === 'string') {
      preferences[field] = value[field].trim()
    }
  })

  if (!preferences.name) {
    delete preferences.name
  }

  const specialties = normalizeSpecialties(value.specialties)

  if (specialties) {
    preferences.specialties = specialties
  }

  return Object.keys(preferences).length ? preferences : null
}

export const getProfilePreferences = () => {
  if(usingApi) return remoteSnapshot().professional
  const storage = getStorage()

  if (!storage) {
    return null
  }

  try {
    const storedValue = storage.getItem(PROFILE_PREFERENCES_STORAGE_KEY)

    if (!storedValue) {
      return null
    }

    return sanitizeProfilePreferences(JSON.parse(storedValue))
  } catch {
    return null
  }
}

export const saveProfilePreferences = (value) => {
  if(usingApi) return remoteMutation('/professional/profile',value).then(result=>({...result,preferences:result.success?sanitizeProfilePreferences(remoteSnapshot().professional):null}))
  const storage = getStorage()
  const preferences = sanitizeProfilePreferences(value)

  if (!storage || !preferences) {
    return { success: false, preferences: null }
  }

  try {
    storage.setItem(
      PROFILE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )

    return { success: true, preferences }
  } catch {
    return { success: false, preferences: null }
  }
}

export const clearProfilePreferences = () => {
  if(usingApi) return remoteMutation('/professional/profile',undefined,'DELETE').then(result=>result.success)
  const storage = getStorage()

  if (!storage) {
    return false
  }

  try {
    storage.removeItem(PROFILE_PREFERENCES_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}