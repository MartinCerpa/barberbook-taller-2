const baseUrl = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  constructor(message,status) { super(message); this.status=status }
}
export async function api(path, { method = 'GET',body,signal } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`,{ method,signal,headers: body ? { 'Content-Type': 'application/json' } : {},body: body ? JSON.stringify(body) : undefined })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('No pudimos conectar con la API. Comprueba que el backend esté disponible.',0)
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(payload?.error?.message || 'No pudimos completar la operación.',response.status)
  if (!payload || !Object.hasOwn(payload,'data')) throw new ApiError('La API devolvió una respuesta inesperada.',response.status)
  return payload.data
}

export const localDateId = () => new Intl.DateTimeFormat('en-CA',{ timeZone: 'America/Santiago',year: 'numeric',month: '2-digit',day: '2-digit' }).format(new Date())
export const queryString = (params) => new URLSearchParams(Object.entries(params).filter(([,value]) => value !== undefined && value !== '')).toString()
export const remoteBooking = async (input) => {
  try { return { success: true,booking: await api('/bookings',{ method: 'POST',body: input }) } }
  catch (error) { return { success: false,error: error.message } }
}
