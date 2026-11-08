export const bookingSelect = `SELECT b.*, b.customer_name_snapshot AS customer_name,u.phone,s.name AS service,
  p.name AS professional_name,
  to_char(b.starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS date_id,
  to_char(b.starts_at AT TIME ZONE 'America/Santiago','HH24:MI') AS time
  FROM bookings b JOIN users u ON u.id=b.customer_id JOIN services s ON s.id=b.service_id
  JOIN professionals p ON p.id=b.professional_id`

export async function findBooking(client, id, lock = false) {
  return (await client.query(`${bookingSelect} WHERE b.id=$1 ${lock ? 'FOR UPDATE OF b' : ''}`, [id])).rows[0]
}

export async function customerId(client, customer) {
  const { randomUUID } = await import('node:crypto')
  return (await client.query(`INSERT INTO users(id,name,phone,role) VALUES($1,$2,$3,'customer')
    ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id`,
  [randomUUID(),customer.name,customer.phone])).rows[0].id
}

export const ticketSelect = `SELECT t.*,t.customer_name_snapshot AS customer_name,s.name AS service,m.name AS module_name,
  p.name AS professional_name,EXTRACT(EPOCH FROM (COALESCE(t.called_at,now())-t.created_at))/60 AS wait_minutes
  FROM tickets t JOIN users u ON u.id=t.customer_id JOIN services s ON s.id=t.service_id
  LEFT JOIN modules m ON m.id=t.module_id LEFT JOIN professionals p ON p.id=t.professional_id`
