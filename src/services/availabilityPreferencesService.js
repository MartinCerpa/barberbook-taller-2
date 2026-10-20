export const BLOCKED_SLOTS_STORAGE_KEY = 'barberbook-taller-2:blocked-slots:v1'
export const ENABLED_SLOTS_STORAGE_KEY = 'barberbook-taller-2:enabled-slots:v1'
export const AVAILABILITY_CHANGE_EVENT = 'barberbook-taller-2:availability-change'

export const notifyAvailabilityChange = () => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(AVAILABILITY_CHANGE_EVENT))
  }
}

const getStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const isValidDateId = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export const isValidTime = (value) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export const sanitizeBlockedSlots = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  const blockedSlots = []
  const seenSlots = new Set()

  value.forEach((slot) => {
    if (
      !slot ||
      typeof slot !== 'object' ||
      Array.isArray(slot) ||
      !isValidDateId(slot.date) ||
      !isValidTime(slot.time)
    ) {
      return
    }

    const slotId = `${slot.date}|${slot.time}`

    if (seenSlots.has(slotId)) {
      return
    }

    seenSlots.add(slotId)
    blockedSlots.push({ date: slot.date, time: slot.time })
  })

  return blockedSlots
}

const readSlots = (key) => {
  const storage = getStorage()

  if (!storage) {
    return []
  }

  try {
    const storedValue = storage.getItem(key)
    return storedValue ? sanitizeBlockedSlots(JSON.parse(storedValue)) : []
  } catch {
    return []
  }
}

const writeSlots = (key, value) => {
  const storage = getStorage()
  const blockedSlots = sanitizeBlockedSlots(value)

  if (!storage) {
    return { success: false, blockedSlots: [] }
  }

  try {
    if (blockedSlots.length) {
      storage.setItem(key, JSON.stringify(blockedSlots))
    } else {
      storage.removeItem(key)
    }

    notifyAvailabilityChange()
    return { success: true, blockedSlots }
  } catch {
    return { success: false, blockedSlots: readSlots(key) }
  }
}

export const getBlockedSlots = () => readSlots(BLOCKED_SLOTS_STORAGE_KEY)
export const saveBlockedSlots = (value) => writeSlots(BLOCKED_SLOTS_STORAGE_KEY, value)
export const getEnabledSlots = () => readSlots(ENABLED_SLOTS_STORAGE_KEY)
export const saveEnabledSlots = (value) => {
  const { success, blockedSlots } = writeSlots(ENABLED_SLOTS_STORAGE_KEY, value)
  return { success, enabledSlots: blockedSlots }
}

export const availabilityPreferencesService = {
  getBlockedSlots,
  saveBlockedSlots,
  getEnabledSlots,
  saveEnabledSlots,
}
