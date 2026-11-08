export const bookingSelect = `SELECT b.*, b.customer_name_snapshot AS customer_name,u.phone,s.name AS service,
  p.name AS professional_name,
  to_char(b.starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS date_id,
  to_char(b.starts_at AT TIME ZONE 'America/Santiago','HH24:MI') AS time
  FROM bookings b JOIN users u ON u.id=b.customer_id JOIN services s ON s.id=b.service_id
  JOIN professionals p ON p.id=b.professional_id`

export async function findBooking(client, id, lock = false) {
  return (await client.query(`${bookingSelect} WHERE b.id=$1 ${lock ? 'FOR UPDATE OF b' : ''}`, [id])).rows[0]
}

export async function customerId(client, customer, professionalId) {
  const { randomUUID } = await import('node:crypto')
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${professionalId||'queue'}:${customer.name.toLowerCase()}:${customer.phone}`])
  const existing=professionalId
    ? await client.query(`SELECT u.id FROM users u JOIN professional_customers pc ON pc.customer_id=u.id WHERE pc.professional_id=$1 AND lower(u.name)=lower($2) AND u.phone=$3 LIMIT 1`,[professionalId,customer.name,customer.phone])
    : await client.query("SELECT id FROM users WHERE role='customer' AND lower(name)=lower($1) AND phone=$2 LIMIT 1",[customer.name,customer.phone])
  const id=existing.rows[0]?.id||randomUUID()
  if(!existing.rowCount)await client.query("INSERT INTO users(id,name,phone,role) VALUES($1,$2,$3,'customer')",[id,customer.name,customer.phone])
  if(professionalId)await client.query('INSERT INTO professional_customers(professional_id,customer_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[professionalId,id])
  return id
}

export const ticketSelect = `SELECT t.*,t.customer_name_snapshot AS customer_name,s.name AS service,m.name AS module_name,
  p.name AS professional_name,EXTRACT(EPOCH FROM (COALESCE(t.called_at,now())-t.created_at))/60 AS wait_minutes
  FROM tickets t JOIN users u ON u.id=t.customer_id JOIN services s ON s.id=t.service_id
  LEFT JOIN modules m ON m.id=t.module_id LEFT JOIN professionals p ON p.id=t.professional_id`
