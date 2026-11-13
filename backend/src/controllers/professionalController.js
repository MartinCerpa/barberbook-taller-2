import { listarReservas, cambiarEstadoReserva } from '../services/bookingService.js';
import { cambiarAprobacion } from '../services/professionalService.js';

export async function bookings(req, res) {
  const status = req.query.status;
  if (Object.keys(req.query).some((key) => key !== 'status') ||
      (status !== undefined && !['pending', 'confirmed', 'rejected', 'cancelled', 'completed'].includes(status))) {
    return res.status(400).json({ error: 'Filtro de estado inválido.' });
  }
  res.json({ data: await listarReservas(req.professional.id, status, req.app.locals.database) });
}

export async function bookingStatus(req, res) {
  const id = Number(req.params.id);
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id) || !req.body ||
      Object.keys(req.body).some((key) => key !== 'status') || !['confirmed', 'rejected'].includes(req.body.status)) {
    return res.status(400).json({ error: 'Revisa la reserva y el estado solicitado.' });
  }
  res.json({ data: await cambiarEstadoReserva(req.professional.id, id, req.body.status, req.app.locals.database) });
}

export async function approval(req, res) {
  if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.automatic_approval !== 'boolean') {
    return res.status(400).json({ error: 'automatic_approval debe ser un booleano.' });
  }
  res.json({ data: await cambiarAprobacion(req.professional.id, req.body.automatic_approval, req.app.locals.database) });
}
