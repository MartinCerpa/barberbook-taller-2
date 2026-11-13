const timeZone = 'America/Santiago';
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('es-CL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const labelFormatter = new Intl.DateTimeFormat('es-CL', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function fechaChile(instant = new Date()) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function etiquetaFecha(dateId) {
  return labelFormatter.format(new Date(`${dateId}T12:00:00Z`));
}

export function adaptarReserva(row) {
  return {
    id: row.id, customerName: row.customer_name, phone: row.customer_phone,
    service: row.service_name, status: row.status, startsAt: row.starts_at,
    dateId: fechaChile(row.starts_at), time: timeFormatter.format(new Date(row.starts_at)),
    endTime: timeFormatter.format(new Date(row.ends_at)),
    duration: (new Date(row.ends_at) - new Date(row.starts_at)) / 60000,
  };
}

export function resumirJornada(pending, confirmed, now = new Date()) {
  const today = fechaChile(now);
  const chronological = [...confirmed].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return {
    today, pendingCount: pending.length,
    confirmedToday: confirmed.filter((row) => fechaChile(row.starts_at) === today).length,
    next: chronological.find((row) => new Date(row.starts_at) >= now),
  };
}
