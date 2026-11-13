import { pool } from '../database/connection.js';
const fail = (status, message) => Object.assign(new Error(message), { status });
const fields = ['name', 'duration_minutes', 'price', 'active'];

export async function consultarServicios(id, database = pool) {
  return (await database.query('SELECT id,name,duration_minutes,price,active FROM services WHERE professional_id=$1 ORDER BY id', [id])).rows;
}

export async function guardarServicio(id, serviceId, body, database = pool) {
  if (!body || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some((key) => !fields.includes(key))) throw fail(400, 'Datos de servicio inválidos.');
  if (serviceId === null && ['name', 'duration_minutes', 'price'].some((key) => body[key] === undefined)) throw fail(400, 'Completa nombre, duración y precio.');
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) throw fail(400, 'Nombre de servicio inválido.');
  if (body.duration_minutes !== undefined && (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 5 || body.duration_minutes > 480 || body.duration_minutes % 5)) throw fail(400, 'Duración: de 5 a 480 minutos, en intervalos de 5.');
  if (body.price !== undefined && (!Number.isInteger(body.price) || body.price < 0 || body.price > 100000000)) throw fail(400, 'Precio inválido.');
  if (body.active !== undefined && typeof body.active !== 'boolean') throw fail(400, 'Disponibilidad de servicio inválida.');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM professionals WHERE id=$1 FOR UPDATE', [id]);
    const previous = serviceId === null ? null : (await client.query('SELECT * FROM services WHERE id=$1 AND professional_id=$2', [serviceId, id])).rows[0];
    if (serviceId !== null && !previous) throw fail(404, 'Servicio no encontrado.');
    const next = { ...previous, ...body, name: body.name?.trim() ?? previous?.name, active: body.active ?? previous?.active ?? true };
    if ((await client.query('SELECT id FROM services WHERE professional_id=$1 AND lower(trim(name))=lower($2) AND ($3::int IS NULL OR id<>$3)', [id, next.name, serviceId])).rowCount) throw fail(409, 'Ya tienes un servicio con ese nombre.');
    const result = serviceId === null
      ? await client.query('INSERT INTO services(professional_id,name,duration_minutes,price,active) VALUES($1,$2,$3,$4,$5) RETURNING id,name,duration_minutes,price,active', [id, next.name, next.duration_minutes, next.price, next.active])
      : await client.query('UPDATE services SET name=$3,duration_minutes=$4,price=$5,active=$6 WHERE id=$1 AND professional_id=$2 RETURNING id,name,duration_minutes,price,active', [serviceId, id, next.name, next.duration_minutes, next.price, next.active]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
