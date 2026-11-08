import { z } from 'zod'

export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)
const name = z.string().trim().min(2).max(100)
export const dateId = z.iso.date()
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const customer = z.object({ name, phone: z.string().transform((p) => p.replace(/[\s()-]/g, '').replace(/^9(?=\d{8}$)/, '+569')).pipe(z.string().regex(/^\+569\d{8}$/)) }).strict()
export const bookingInput = z.object({ id: id.optional(), professionalId: id, serviceId: id, dateId, time, customer }).strict()
export const bookingEdit = z.object({ dateId: dateId.optional(), time: time.optional(), duration: z.number().int().min(5).max(480).optional() }).strict().refine((v) => Object.keys(v).length > 0)
export const bookingStatus = z.object({ status: z.enum(['confirmed','rejected','cancelled','completed','no_show']) }).strict()
export const ticketInput = z.object({ id: id.optional(), branchId: id, serviceId: id, customer }).strict()
export const ticketStatus = z.object({ status: z.enum(['completed','cancelled']) }).strict()
export const moduleInput = z.object({ moduleId: id }).strict()
export const blockInput = z.object({ professionalId: id, dateId, time, duration: z.number().int().min(5).max(480) }).strict()
export const availabilityInput = z.object({ professionalId: id, weekday: z.number().int().min(0).max(6), intervals: z.array(z.object({ start: time, end: time }).strict().refine((v) => v.start < v.end)).max(10) }).strict()
export const catalogs = {
  branches: z.object({ name, address: z.string().trim().min(2).max(200), active: z.boolean().optional() }).strict(),
  services: z.object({ branchId: id, name, description: z.string().max(500).optional(), duration: z.number().int().min(5).max(480), price: z.number().int().min(0).max(100000000), active: z.boolean().optional() }).strict(),
  professionals: z.object({ branchId: id, name, title: z.string().max(150).optional(), bio: z.string().max(1000).optional(), active: z.boolean().optional() }).strict(),
  modules: z.object({ branchId: id, professionalId: id, name, active: z.boolean().optional() }).strict(),
}

export const readId = (value) => id.parse(value)
export const readLimit = (value) => z.coerce.number().int().min(1).max(500).default(100).parse(value)
