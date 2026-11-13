import { useEffect, useState } from 'react';
import { obtenerDisponibilidad } from '../services/api';

// Conserva el contrato del hook original; solo convierte etiquetas de presentación.
export default function useApiAvailability(professionalId, serviceId, revision = 0) {
  const [result, setResult] = useState({ key: '', days: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${professionalId}|${serviceId}|${revision}|${attempt}`;
  useEffect(() => {
    if (!serviceId || !professionalId) return;
    const controller = new AbortController();
    obtenerDisponibilidad(professionalId, serviceId, controller.signal)
      .then((days) => { if (!controller.signal.aborted) setResult({ key, days, error: null }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key, days: [], error: error.message }); });
    return () => controller.abort();
  }, [professionalId, serviceId, key]);

  const state = !serviceId || !professionalId ? { days: [], loading: false, error: null }
    : result.key === key ? { ...result, loading: false } : { days: [], loading: true, error: null };
  const dates = state.days.map((day) => {
    const date = new Date(`${day.id}T12:00:00`);
    return { ...day, label: date.toLocaleDateString('es-CL', { weekday: 'short' }), dayNumber: date.getDate(),
      month: date.toLocaleDateString('es-CL', { month: 'short' }), note: day.available ? 'Disponible' : 'Sin horarios' };
  });
  return { ...state, dates, retry: () => setAttempt((value) => value + 1) };
}
