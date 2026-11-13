import { consultarDisponibilidad, validateAvailabilityQuery } from '../services/availabilityService.js';

export async function obtenerDisponibilidad(req, res, next) {
  try {
    const query = validateAvailabilityQuery(req.query);
    res.json({ data: await consultarDisponibilidad(query, req.app.locals.database) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
}
