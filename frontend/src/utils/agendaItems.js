import { adaptarReserva } from './panelData.js';

// Combina oferta calculada por el servidor con reservas reales, sin fabricar ocupación.
export function crearAgendaItems(day) {
  const confirmed = day.bookings.filter((b) => b.status === 'confirmed');
  const items = confirmed.map(adaptarReserva);
  const pending = new Map();
  for (const row of day.bookings.filter((b) => b.status === 'pending')) {
    const key = new Date(row.starts_at).toISOString();
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key).push(row);
  }
  for (const [key, rows] of pending) items.push({ ...adaptarReserva(rows[0]), id: `pending-${key}`, requestCount: rows.length });
  for (const slot of day.slots) {
    if (pending.has(new Date(slot.startsAt).toISOString()) || confirmed.some((b) => new Date(b.starts_at) <= new Date(slot.startsAt) && new Date(b.ends_at) > new Date(slot.startsAt))) continue;
    const available = slot.services.filter((s) => s.isBookable);
    if (!available.length && slot.services.every((s) => s.status === 'confirmed')) continue;
    items.push({ id: `slot-${slot.startsAt}`, startsAt: slot.startsAt, time: slot.time,
      status: available.length ? available.some((s) => s.status === 'pending') ? 'pending' : 'available' : 'unavailable',
      offeredServices: available.map((s) => `${s.name} · ${s.duration} min`), requestCount: null });
  }
  return items.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}
