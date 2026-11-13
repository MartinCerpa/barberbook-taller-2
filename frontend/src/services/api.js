export async function consultarApi(ruta, opciones = {}) {
  const { mensajeRed, ...fetchOptions } = opciones;
  let respuesta;
  let resultado;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...fetchOptions,
      credentials: 'include',
      signal: opciones.signal
        ? AbortSignal.any([opciones.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
    resultado = await respuesta.json();
  } catch (causa) {
    if (opciones.signal?.aborted) throw causa;
    throw new Error(mensajeRed || 'No pudimos comprobar la información. Revisa tu conexión y vuelve a consultar antes de repetir una operación.', { cause: causa });
  }
  if (!respuesta.ok) {
    const error = new Error(typeof resultado.error === 'string'
      ? resultado.error
      : resultado.error?.message || 'No se pudo completar la solicitud.');
    error.status = respuesta.status;
    throw error;
  }
  return resultado;
}

export function obtenerEstadoServidor() {
  return consultarApi('/health');
}

export async function obtenerProfesionales(signal) {
  const resultado = await consultarApi('/professionals', { signal });
  if (!Array.isArray(resultado.data)) throw new Error('La respuesta de profesionales no es válida.');
  return resultado.data;
}

export async function obtenerServicios(signal) {
  const resultado = await consultarApi('/services', { signal });
  if (!Array.isArray(resultado.data)) throw new Error('La respuesta de servicios no es válida.');
  // Adaptar el contrato SQL nuevo a las props de los componentes originales.
  return resultado.data.map((servicio) => ({
    id: servicio.id,
    professionalId: servicio.professional_id,
    name: servicio.name,
    duration: servicio.duration_minutes,
    price: Number(servicio.price),
  }));
}

export async function obtenerDisponibilidad(professionalId, serviceId, signal) {
  // La fecha inicial la decide PostgreSQL en America/Santiago, no el reloj del navegador.
  const query = new URLSearchParams({ professionalId, serviceId, days: 14 });
  const resultado = await consultarApi(`/availability?${query}`, { signal });
  if (!Array.isArray(resultado.data) || resultado.data.some((day) => !Array.isArray(day.slots))) {
    throw new Error('La respuesta de disponibilidad no es válida.');
  }
  return resultado.data;
}

export async function crearReserva(datos) {
  const resultado = await consultarApi('/bookings', {
    method: 'POST',
    mensajeRed: 'No pudimos comprobar si tu solicitud se registró. Antes de reenviarla, consulta al profesional para evitar duplicarla.',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!resultado.data?.id || !['pending', 'confirmed'].includes(resultado.data.status)) {
    throw new Error('La respuesta no permite comprobar el estado de la solicitud. Consulta al profesional antes de reenviarla.');
  }
  return resultado.data;
}
