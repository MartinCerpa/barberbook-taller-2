export const HOLIDAY_API = 'https://nagerholidays.com/api/v4/Holidays/CL'

export function normalizeHolidays(payload, year) {
  if (!Array.isArray(payload)) throw new Error('Respuesta de feriados inválida.')
  const dates = new Map()
  for (const item of payload) {
    if (!item || typeof item.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
      !Number.isFinite(Date.parse(`${item.date}T12:00:00Z`)) ||
      new Date(`${item.date}T12:00:00Z`).toISOString().slice(0, 10) !== item.date ||
      Number(item.date.slice(0, 4)) !== year ||
      item.countryCode !== 'CL' ||
      typeof item.name !== 'string' || !item.name.trim() ||
      typeof item.nationalHoliday !== 'boolean' ||
      !Array.isArray(item.holidayTypes) ||
      !item.holidayTypes.every((type) => typeof type === 'string')) {
      throw new Error('Respuesta de feriados inválida.')
    }
    // Un feriado regional o bancario no representa un feriado público nacional.
    if (!item.nationalHoliday || !item.holidayTypes.includes('Public')) continue
    const names = dates.get(item.date) ?? new Set()
    names.add(item.name.trim())
    dates.set(item.date, names)
  }
  return [...dates].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, names]) => ({ date, name: [...names].join(' · ') }))
}

export async function fetchHolidays(year, { signal, fetcher = fetch } = {}) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error('Año de consulta inválido.')
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(abort, 10000)
  try {
    const response = await fetcher(`${HOLIDAY_API}/${year}`, {
      signal: controller.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('No fue posible consultar los feriados.')
    return normalizeHolidays(await response.json(), year)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
