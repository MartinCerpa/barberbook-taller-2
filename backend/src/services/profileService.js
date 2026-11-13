import { pool } from '../database/connection.js';

const fields = ['name', 'bio', 'title', 'specialties', 'location', 'instagram', 'whatsapp'];
const columns = 'id,name,bio,title,specialties,location,instagram,whatsapp';
const invalid = () => Object.assign(new Error('Revisa los datos del perfil.'), { status: 400 });

export async function consultarPerfil(id, database = pool) {
  return (await database.query(`SELECT ${columns} FROM professionals WHERE id=$1`, [id])).rows[0];
}

export async function guardarPerfil(id, body, database = pool) {
  if (!body || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some((key) => !fields.includes(key))) throw invalid();
  const values = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'specialties') {
      if (!Array.isArray(value) || value.length > 8 || value.some((s) => typeof s !== 'string' || !s.trim() || s.trim().length > 60)) throw invalid();
      values[key] = [...new Set(value.map((s) => s.trim()))];
    } else {
      if (typeof value !== 'string' || value.trim().length > (key === 'bio' ? 2000 : key === 'location' ? 200 : 100) || (key === 'name' && !value.trim())) throw invalid();
      values[key] = value.trim();
    }
  }
  if (values.instagram && !/^@?[A-Za-z0-9_.]{1,30}$/.test(values.instagram)) throw invalid();
  if (values.whatsapp && !/^\+?[0-9 ()-]{6,30}$/.test(values.whatsapp)) throw invalid();
  // Las columnas solo pueden provenir de la lista fija anterior; valores parametrizados.
  const keys = Object.keys(values);
  return (await database.query(`UPDATE professionals SET ${keys.map((key, i) => `${key}=$${i + 2}`).join(',')}
    WHERE id=$1 RETURNING ${columns}`, [id, ...Object.values(values)])).rows[0];
}
