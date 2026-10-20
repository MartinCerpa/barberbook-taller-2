export const HOLIDAY_API = 'https://nagerholidays.com/api/v4/Holidays/CL'

// Relaciona los nombres exactos de Nager.Holidays con sus nombres oficiales en Chile.
const NOMBRES_FERIADOS_CHILE = Object.freeze({
  "New Year's Day": 'Año Nuevo',
  'Good Friday': 'Viernes Santo',
  'Holy Saturday': 'Sábado Santo',
  'Labour Day': 'Día Nacional del Trabajo',
  'Navy Day': 'Día de las Glorias Navales',
  'Battle of Arica': 'Asalto y Toma del Morro de Arica',
  'National Day of Indigenous Peoples': 'Día Nacional de los Pueblos Indígenas',
  'Saint Peter and Saint Paul': 'San Pedro y San Pablo',
  'Our Lady of Mount Carmel': 'Día de la Virgen del Carmen',
  'Assumption of Mary': 'Asunción de la Virgen',
  'National holiday': 'Independencia Nacional',
  'Army Day': 'Día de las Glorias del Ejército',
  'Columbus Day': 'Encuentro de Dos Mundos',
  'Reformation Day': 'Día de las Iglesias Evangélicas y Protestantes',
  'All Saints Day': 'Día de Todos los Santos',
  'Immaculate Conception': 'Inmaculada Concepción',
  'Christmas Day': 'Navidad',
})

export function obtenerNombreFeriadoChile(feriadoApi) {
  const nombreOriginal = typeof feriadoApi?.name === 'string' ? feriadoApi.name.trim() : ''
  const nombreTraducido = NOMBRES_FERIADOS_CHILE[nombreOriginal]
  if (nombreTraducido) return nombreTraducido

  const nombreLocal = typeof feriadoApi?.localName === 'string' ? feriadoApi.localName.trim() : ''
  return nombreLocal || nombreOriginal
}

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
    nombres.add(obtenerNombreFeriadoChile(feriadoApi))
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
