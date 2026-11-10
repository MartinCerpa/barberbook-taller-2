export async function obtenerEstadoServidor() {
  const respuesta = await fetch('/api/health');

  if (!respuesta.ok) {
    throw new Error('Error al consultar el servidor');
  }

  return respuesta.json();
}