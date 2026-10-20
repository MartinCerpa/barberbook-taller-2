export const HOLIDAY_API = 'https://nagerholidays.com/api/v4/Holidays/CL'

export function normalizarFeriados(payload, anio) {
  if (!Array.isArray(payload)) throw new Error('Respuesta de feriados inválida.')
  const feriadosPorFecha = new Map()

  // Valida el JSON externo antes de utilizarlo en la interfaz.
  for (const feriadoApi of payload) {
    if (!feriadoApi || typeof feriadoApi.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(feriadoApi.date) ||
      !Number.isFinite(Date.parse(`${feriadoApi.date}T12:00:00Z`)) ||
      new Date(`${feriadoApi.date}T12:00:00Z`).toISOString().slice(0, 10) !== feriadoApi.date ||
      Number(feriadoApi.date.slice(0, 4)) !== anio ||
      feriadoApi.countryCode !== 'CL' ||
      typeof feriadoApi.name !== 'string' || !feriadoApi.name.trim() ||
      typeof feriadoApi.nationalHoliday !== 'boolean' ||
      !Array.isArray(feriadoApi.holidayTypes) ||
      !feriadoApi.holidayTypes.every((tipo) => typeof tipo === 'string')) {
      throw new Error('Respuesta de feriados inválida.')
    }

    // Un feriado regional o bancario no representa un feriado público nacional.
    if (!feriadoApi.nationalHoliday || !feriadoApi.holidayTypes.includes('Public')) continue
    const nombres = feriadosPorFecha.get(feriadoApi.date) ?? new Set()
    nombres.add(feriadoApi.name.trim())
    feriadosPorFecha.set(feriadoApi.date, nombres)
  }

  return [...feriadosPorFecha].sort(([fechaA], [fechaB]) => fechaA.localeCompare(fechaB))
    .map(([date, nombres]) => ({ date, name: [...nombres].join(' · ') }))
}

export async function consultarFeriados(anio, { signal, fetcher = fetch } = {}) {
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) {
    throw new Error('Año de consulta inválido.')
  }

  const controlador = new AbortController()
  const cancelar = () => controlador.abort()
  signal?.addEventListener('abort', cancelar, { once: true })
  if (signal?.aborted) controlador.abort()
  const temporizador = setTimeout(cancelar, 10000)

  try {
    // Consulta los feriados públicos de Chile para el año solicitado.
    const response = await fetcher(`${HOLIDAY_API}/${anio}`, {
      signal: controlador.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('No fue posible consultar los feriados.')
    return normalizarFeriados(await response.json(), anio)
  } finally {
    clearTimeout(temporizador)
    signal?.removeEventListener('abort', cancelar)
  }
}
