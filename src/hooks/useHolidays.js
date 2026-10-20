import { useEffect, useState } from 'react'
import { fetchHolidays } from '../services/holidayService.js'

const cache = new Map()
const CACHE_MS = 5 * 60 * 1000

export default function useHolidays(dateIds) {
  // Puede haber dos años visibles en el cambio diciembre/enero.
  const yearsKey = [...new Set(dateIds.filter(Boolean).map((id) => id.slice(0, 4)))]
    .sort().join(',')
  const [attempt, setAttempt] = useState(0)
  const key = `${yearsKey}:${attempt}`
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const years = yearsKey ? yearsKey.split(',').map(Number) : []
    const load = async () => {
      try {
        const rows = await Promise.all(years.map(async (year) => {
          const stored = cache.get(year)
          if (stored && Date.now() - stored.time < CACHE_MS) return stored.rows
          const holidays = await fetchHolidays(year, { signal: controller.signal })
          if (!controller.signal.aborted) cache.set(year, { rows: holidays, time: Date.now() })
          return holidays
        }))
        if (!controller.signal.aborted) {
          setResult({ key, status: 'success', holidays: rows.flat() })
        }
      } catch {
        if (!controller.signal.aborted) setResult({ key, status: 'error', holidays: [] })
      }
    }
    load()
    return () => controller.abort()
  }, [yearsKey, key])

  const current = result?.key === key ? result : { status: 'loading', holidays: [] }
  return {
    ...current,
    years: yearsKey.replaceAll(',', ' / '),
    byDate: new Map(current.holidays.map((holiday) => [holiday.date, holiday.name])),
    retry: () => {
      yearsKey.split(',').forEach((year) => cache.delete(Number(year)))
      setAttempt((value) => value + 1)
    },
  }
}
