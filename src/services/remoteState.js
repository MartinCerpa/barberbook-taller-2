import { api, setSessionToken } from './api.js'
export const usingApi = import.meta.env !== undefined
let snapshot = null,
  session = null,
  queue = Promise.resolve()
export const remoteSnapshot = () => {
  if (!snapshot)
    throw new Error('La información del profesional aún no está cargada.')
  return snapshot
}
export const professionalSession = () => session
export const setProfessionalSession = (value) => {
  session = value
  setSessionToken(value?.csrfToken || '')
}
export async function refreshProfessional() {
  snapshot = await api('/professional/state')
  for (const event of [
    'barberbook-taller-2:bookings-change',
    'barberbook-taller-2:availability-change',
    'barberbook-taller-2:reservation-preferences-change',
    'barberbook:remote-change',
  ])
    window.dispatchEvent(new Event(event))
  return snapshot
}
export function remoteMutation(path, body, method = 'PUT') {
  const operation = queue.then(async () => {
    try {
      const data = await api(path, { method, body })
      await refreshProfessional()
      return {
        success: true,
        changed: true,
        data,
        booking: data?.id
          ? snapshot.records.find((r) => r.id === data.id)
          : undefined,
        undoToken: data?.undoToken ? { token: data.undoToken } : null,
        services: snapshot.services,
        hours: snapshot.workingHours,
        preferences: snapshot.preferences,
        errors: {},
      }
    } catch (error) {
      return { success: false, error: error.message, errors: {} }
    }
  })
  queue = operation.then(() => {})
  return operation
}
export async function logoutProfessional() {
  await api('/auth/logout', { method: 'POST', body: {} })
  snapshot = null
  setProfessionalSession(null)
  window.dispatchEvent(new Event('barberbook:auth-expired'))
}
export function clearProfessional() {
  snapshot = null
  setProfessionalSession(null)
}
