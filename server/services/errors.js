export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export function requireFound(row, message = 'Recurso no encontrado.') {
  if (!row) throw new HttpError(404, message)
  return row
}
