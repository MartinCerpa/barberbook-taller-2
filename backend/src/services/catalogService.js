import { pool } from '../database/connection.js';

export async function listarProfesionales(database = pool) {
  const resultado = await database.query(
    `SELECT p.id,p.name,p.bio,p.title,p.specialties,p.location,p.instagram,p.whatsapp,p.automatic_approval,
       COALESCE((SELECT json_agg(json_build_object('weekday',w.weekday,'startMinute',w.start_minute,'endMinute',w.end_minute)
         ORDER BY w.weekday,w.start_minute) FROM working_hours w WHERE w.professional_id=p.id),'[]'::json) AS working_hours
     FROM professionals p ORDER BY p.id`
  );

  return resultado.rows;
}

export async function listarServicios(database = pool) {
  const resultado = await database.query(
    'SELECT id, professional_id, name, duration_minutes, price FROM services WHERE active ORDER BY id'
  );

  return resultado.rows;
}
