import { randomUUID } from 'node:crypto'
import { transaction } from './transaction.js'
import { requireFound, HttpError } from '../services/errors.js'

const columns = {
  branches: { name: 'name', address: 'address', active: 'active' },
  services: { branchId: 'branch_id', name: 'name', description: 'description', duration: 'duration', price: 'price', active: 'active' },
  professionals: { branchId: 'branch_id', name: 'name', title: 'title', bio: 'bio', active: 'active' },
  modules: { branchId: 'branch_id', professionalId: 'professional_id', name: 'name', active: 'active' },
}
export const camelRow = (row) => Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/_([a-z])/g, (_,c) => c.toUpperCase()), v]))

export function catalogRepository(pool) {
  return {
    async list(resource) {
      return (await pool.query(`SELECT * FROM ${resource} ORDER BY name,id`)).rows.map(camelRow)
    },
    async get(resource, id) {
      return camelRow(requireFound((await pool.query(`SELECT * FROM ${resource} WHERE id=$1`, [id])).rows[0]))
    },
    async save(resource, input, id) {
      return transaction(pool, async (client) => {
        // Identificadores SQL provienen exclusivamente del mapa privado de columnas.
        const fields = Object.entries(columns[resource]).filter(([key]) => input[key] !== undefined)
        let result
        if (id) {
          if (!fields.length) throw new HttpError(400, 'No hay campos para actualizar.')
          result = await client.query(`UPDATE ${resource} SET ${fields.map(([,col],i) => `${col}=$${i+2}`).join(',')} WHERE id=$1 RETURNING *`, [id,...fields.map(([key]) => input[key])])
        } else {
          id = randomUUID()
          const names = ['id',...fields.map(([,col]) => col)]
          const values = [id,...fields.map(([key]) => input[key])]
          if (resource === 'professionals') {
            const userId = randomUUID()
            await client.query("INSERT INTO users(id,name,role) VALUES($1,$2,'professional')", [userId,input.name])
            names.push('user_id'); values.push(userId)
          }
          result = await client.query(`INSERT INTO ${resource}(${names.join(',')}) VALUES(${values.map((_,i) => `$${i+1}`).join(',')}) RETURNING *`, values)
        }
        const row = requireFound(result.rows[0])
        if (resource === 'professionals') await client.query('UPDATE users SET name=$1 WHERE id=$2', [row.name,row.user_id])
        return camelRow(row)
      })
    },
    async deactivate(resource, id) {
      return camelRow(requireFound((await pool.query(`UPDATE ${resource} SET active=false WHERE id=$1 RETURNING *`, [id])).rows[0]))
    },
  }
}
