import { useEffect, useState } from 'react'
import { consultarFeriados } from '../services/holidayService.js'

const cacheFeriados = new Map()
const DURACION_CACHE_MS = 5 * 60 * 1000

export default function useFeriados(idsFechas) {
  // Puede haber dos años visibles en el cambio diciembre/enero.
  const claveAnios = [...new Set(idsFechas.filter(Boolean).map((id) => id.slice(0, 4)))]
    .sort().join(',')
  const [intento, setIntento] = useState(0)
  const claveConsulta = `${claveAnios}:${intento}`
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    const controlador = new AbortController()
    const anios = claveAnios ? claveAnios.split(',').map(Number) : []

    // Consulta la API cuando cambia el año visible o se solicita un reintento.
    const cargarFeriados = async () => {
      try {
        const resultadosPorAnio = await Promise.all(anios.map(async (anio) => {
          const guardado = cacheFeriados.get(anio)
          if (guardado && Date.now() - guardado.hora < DURACION_CACHE_MS) {
            return guardado.feriados
          }

          const feriados = await consultarFeriados(anio, { signal: controlador.signal })
          if (!controlador.signal.aborted) {
            cacheFeriados.set(anio, { feriados, hora: Date.now() })
          }
          return feriados
        }))

        if (!controlador.signal.aborted) {
          setResultado({
            clave: claveConsulta,
            estado: 'listo',
            feriados: resultadosPorAnio.flat(),
          })
        }
      } catch {
        // Si la API falla, la reserva puede continuar normalmente.
        if (!controlador.signal.aborted) {
          setResultado({ clave: claveConsulta, estado: 'error', feriados: [] })
        }
      }
    }

    cargarFeriados()
    return () => controlador.abort()
  }, [claveAnios, claveConsulta])

  const actual = resultado?.clave === claveConsulta
    ? resultado
    : { estado: 'cargando', feriados: [] }

  return {
    ...actual,
    porFecha: new Map(actual.feriados.map((feriado) => [feriado.date, feriado.name])),
    reintentar: () => {
      claveAnios.split(',').forEach((anio) => cacheFeriados.delete(Number(anio)))
      setIntento((valor) => valor + 1)
    },
  }
}
