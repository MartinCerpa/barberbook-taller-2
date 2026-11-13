import { consultarPerfil, guardarPerfil } from '../services/profileService.js';
import { consultarServicios, guardarServicio } from '../services/serviceManagementService.js';
import { consultarJornada, guardarJornada } from '../services/workingHoursService.js';
import { consultarAgenda } from '../services/agendaService.js';

const database = (req) => req.app.locals.database;
const id = (req) => req.professional.id;

export async function profile(req, res) { res.json({ data: await consultarPerfil(id(req), database(req)) }); }
export async function updateProfile(req, res) { res.json({ data: await guardarPerfil(id(req), req.body, database(req)) }); }
export async function services(req, res) { res.json({ data: await consultarServicios(id(req), database(req)) }); }
export async function createService(req, res) { res.status(201).json({ data: await guardarServicio(id(req), null, req.body, database(req)) }); }
export async function updateService(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) return res.status(400).json({ error: 'Identificador de servicio inválido.' });
  res.json({ data: await guardarServicio(id(req), Number(req.params.id), req.body, database(req)) });
}
export async function hours(req, res) { res.json({ data: await consultarJornada(id(req), database(req)) }); }
export async function updateHours(req, res) { res.json({ data: await guardarJornada(id(req), req.body, database(req)) }); }
export async function agenda(req, res) {
  if (Object.keys(req.query).length) return res.status(400).json({ error: 'La agenda usa los próximos 14 días del profesional autenticado.' });
  res.json({ data: await consultarAgenda(id(req), database(req)) });
}
