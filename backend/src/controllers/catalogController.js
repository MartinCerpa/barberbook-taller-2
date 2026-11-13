import {
  listarProfesionales,
  listarServicios
} from '../services/catalogService.js';

export async function obtenerProfesionales(req, res) {
  const profesionales = await listarProfesionales(req.app.locals.database);

  res.json({ data: profesionales });
}

export async function obtenerServicios(req, res) {
  const servicios = await listarServicios(req.app.locals.database);

  res.json({ data: servicios });
}
