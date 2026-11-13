import { pool } from '../database/connection.js';

export async function cambiarAprobacion(professionalId, automaticApproval, database = pool) {
  // El UPDATE toma el bloqueo de esta fila; no confirma ni rechaza solicitudes previas.
  const { rows: [professional] } = await database.query(
    'UPDATE professionals SET automatic_approval=$2 WHERE id=$1 RETURNING id,name,automatic_approval',
    [professionalId, automaticApproval]);
  return professional;
}
