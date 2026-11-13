import { consultarApi } from './api';

export async function obtenerSesion(signal) {
  return (await consultarApi('/auth/session', { signal })).data;
}

export async function iniciarSesion(email, password) {
  return (await consultarApi('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })).data;
}

function escribir(ruta, method, csrfToken, body) {
  return consultarApi(ruta, {
    method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function cerrarSesion(csrfToken) {
  return escribir('/auth/logout', 'POST', csrfToken);
}

export async function obtenerReservas(status, signal) {
  const { data } = await consultarApi(`/professional/bookings?${new URLSearchParams({ status })}`, { signal });
  if (!Array.isArray(data)) throw new Error('La respuesta de reservas no es válida.');
  return data;
}

export function cambiarEstado(id, status, csrfToken) {
  return escribir(`/professional/bookings/${id}/status`, 'PATCH', csrfToken, { status });
}

export function guardarAprobacion(automatic_approval, csrfToken) {
  return escribir('/professional/settings', 'PATCH', csrfToken, { automatic_approval });
}

export async function obtenerPerfil(signal) { return (await consultarApi('/professional/profile', { signal })).data; }
export async function guardarPerfil(body, csrf) { return (await escribir('/professional/profile', 'PATCH', csrf, body)).data; }
export async function obtenerServiciosPrivados(signal) { return (await consultarApi('/professional/services', { signal })).data; }
export async function guardarServicio(id, body, csrf) {
  return (await escribir(`/professional/services${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', csrf, body)).data;
}
export async function obtenerJornada(signal) { return (await consultarApi('/professional/working-hours', { signal })).data; }
export async function guardarJornada(body, csrf) { return (await escribir('/professional/working-hours', 'PUT', csrf, body)).data; }
export async function obtenerAgenda(signal) { return (await consultarApi('/professional/agenda', { signal })).data; }
