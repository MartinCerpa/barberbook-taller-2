import { camelRow } from '../repositories/catalogRepository.js'

export function metricsService(pool) {
  return {
    async summary(branchId) {
      const { rows: [queue] } = await pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE status='pending')::int AS pending,
        COUNT(*) FILTER(WHERE status='called')::int AS called,
        COUNT(*) FILTER(WHERE status='completed')::int AS completed,
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (called_at-created_at))/60) FILTER(WHERE called_at IS NOT NULL),2),0)::float AS average_wait_minutes,
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (completed_at-called_at))/60) FILTER(WHERE status='completed'),2),0)::float AS average_service_minutes
        FROM tickets WHERE ($1::text IS NULL OR branch_id=$1)`, [branchId ?? null])
      const { rows: [bookings] } = await pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE status='pending')::int AS pending,
        COUNT(*) FILTER(WHERE status='confirmed')::int AS confirmed,
        COUNT(*) FILTER(WHERE status='completed')::int AS completed,
        COALESCE(SUM(price) FILTER(WHERE status='completed'),0)::float AS revenue
        FROM bookings WHERE ($1::text IS NULL OR branch_id=$1)`, [branchId ?? null])
      return { queue: camelRow(queue),bookings: camelRow(bookings) }
    },
    async customers() {
      return (await pool.query(`SELECT u.id,u.name,u.phone,COUNT(b.id)::int AS bookings,
        COUNT(b.id) FILTER(WHERE b.status='completed')::int AS completed,
        COALESCE(SUM(b.price) FILTER(WHERE b.status='completed'),0)::float AS spent
        FROM users u LEFT JOIN bookings b ON b.customer_id=u.id WHERE u.role='customer'
        GROUP BY u.id ORDER BY u.name LIMIT 500`)).rows
    },
    async history(limit) {
      return (await pool.query(`SELECT id,'booking' AS type,status,updated_at AS occurred_at FROM bookings
        WHERE status IN ('rejected','cancelled','completed','no_show')
        UNION ALL SELECT id,'ticket',status,COALESCE(completed_at,called_at,created_at) FROM tickets
        WHERE status IN ('completed','cancelled') ORDER BY occurred_at DESC LIMIT $1`, [limit])).rows.map(camelRow)
    },
  }
}
