import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { hashPassword } from '../services/authService.js'
export async function authenticatedAgent(
  app,
  pool,
  professionalId = 'professional-matias',
  admin = true,
) {
  const {
    rows: [p],
  } = await pool.query('SELECT user_id FROM professionals WHERE id=$1', [
    professionalId,
  ])
  const password = randomUUID() + randomUUID(),
    email = `${randomUUID()}@test.invalid`
  await pool.query(
    'INSERT INTO professional_credentials(user_id,email,password_hash,is_admin) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET email=$2,password_hash=$3,is_admin=$4',
    [p.user_id, email, await hashPassword(password), admin],
  )
  const agent = request.agent(app),
    login = await agent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200)
  agent.set('X-CSRF-Token', login.body.data.csrfToken)
  return { agent, email, password, login }
}
