import { useEffect, useState } from 'react'
import { api,localDateId,queryString } from '../services/api.js'

export default function useApiAvailability(professionalId,serviceId,revision,horizon=14) {
  const [result,setState] = useState({ key: '',days: [],error: null })
  const [retry,setRetry] = useState(0)
  const key = `${professionalId}|${serviceId}|${revision}|${retry}|${horizon}`
  useEffect(() => {
    if (!serviceId) return
    const controller = new AbortController()
    api(`/availability?${queryString({ professionalId,serviceId,startDate: localDateId(),days: horizon })}`,{ signal: controller.signal })
      .then((days) => setState({ key,days,error: null }))
      .catch((error) => { if (!controller.signal.aborted) setState({ key,days: [],error: error.message }) })
    return () => controller.abort()
  },[professionalId,serviceId,key,horizon])
  const state = !serviceId ? { days: [],loading: false,error: null } : result.key === key ? { ...result,loading: false } : { days: [],loading: true,error: null }
  const dates = state.days.map((day) => {
    const date = new Date(`${day.id}T12:00:00`)
    return { ...day,label: date.toLocaleDateString('es-CL',{ weekday: 'short' }),dayNumber: date.getDate(),month: date.toLocaleDateString('es-CL',{ month: 'short' }),note: day.available ? 'Disponible' : 'Sin horarios' }
  })
  return { ...state,dates,retry: () => setRetry((value) => value+1) }
}
