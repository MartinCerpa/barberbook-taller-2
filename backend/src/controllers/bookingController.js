import { crearReserva } from '../services/bookingService.js';

export async function registrarReserva(req, res, next) {
  const { serviceId, customerName, customerPhone, startsAt } = req.body ?? {};

  const fecha = new Date(startsAt);

  if (
    !Number.isInteger(serviceId) ||
    serviceId <= 0 ||
    typeof customerName !== 'string' ||
    !customerName.trim() ||
    typeof customerPhone !== 'string' ||
    !customerPhone.trim() ||
    typeof startsAt !== 'string' ||
    !/([zZ]|[+-]\d{2}:\d{2})$/.test(startsAt) ||
    Number.isNaN(fecha.getTime()) ||
    fecha.getTime() <= Date.now()
  ) {
    return res.status(400).json({
      error: 'Datos de reserva inválidos'
    });
  }

  try {
    const reserva = await crearReserva({
      serviceId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      startsAt
    }, req.app.locals.database);

    res.status(201).json({ data: reserva });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message
      });
    }

    next(error);
  }
}
