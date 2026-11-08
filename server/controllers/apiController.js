import { catalogRepository } from '../repositories/catalogRepository.js'
import { bookingService } from '../services/bookingService.js'
import { availabilityService } from '../services/availabilityService.js'
import { ticketService } from '../services/ticketService.js'
import { metricsService } from '../services/metricsService.js'

export function createControllers({ pool, mongo }, events) {
  const catalog = catalogRepository(pool)
  const bookings = bookingService(pool)
  const availability = availabilityService(pool)
  const tickets = ticketService(pool)
  const metrics = metricsService(pool)
  const respond = (res, data, status = 200) => res.status(status).json({ data })
  const controllers = {
    health: async (_req,res) => {
      await pool.query('SELECT 1')
      await mongo.db().command({ ping: 1 })
      const pending = Number((await pool.query('SELECT COUNT(*) FROM event_outbox WHERE delivered_at IS NULL')).rows[0].count)
      respond(res,{ status: 'ok',postgres: 'connected',mongo: 'connected',pendingEvents: pending })
    },
    bookingList: async (req,res) => respond(res,await bookings.list(req.validated.query)),
    bookingGet: async (req,res) => respond(res,await bookings.get(req.params.id)),
    bookingCreate: async (req,res) => { const result = await bookings.create(req.body); respond(res,result.booking,result.created ? 201 : 200) },
    bookingStatus: async (req,res) => respond(res,await bookings.status(req.params.id,req.body.status)),
    bookingEdit: async (req,res) => respond(res,await bookings.edit(req.params.id,req.body)),
    availabilityGet: async (req,res) => { const q=req.validated.query; respond(res,await availability.get(q.professionalId,q.serviceId,q.startDate,q.days)) },
    availabilityWeekly: async (req,res) => respond(res,await availability.weekly(req.validated.query.professionalId)),
    availabilitySet: async (req,res) => respond(res,await availability.set(req.body)),
    blockList: async (_req,res) => respond(res,await availability.blocks()),
    blockCreate: async (req,res) => respond(res,await availability.block(req.body),201),
    blockDelete: async (req,res) => respond(res,await availability.unblock(req.params.id)),
    ticketList: async (req,res) => respond(res,await tickets.list(req.validated.query)),
    ticketGet: async (req,res) => respond(res,await tickets.get(req.params.id)),
    ticketCreate: async (req,res) => { const result=await tickets.create(req.body); respond(res,result.ticket,result.created ? 201 : 200) },
    ticketNext: async (req,res) => respond(res,await tickets.next(req.body.moduleId)),
    ticketStatus: async (req,res) => respond(res,await tickets.status(req.params.id,req.body.status)),
    metrics: async (req,res) => respond(res,await metrics.summary(req.validated.query.branchId)),
    customers: async (_req,res) => respond(res,await metrics.customers()),
    history: async (req,res) => respond(res,await metrics.history(req.validated.query.limit)),
    events: async (req,res) => respond(res,await events.list(req.validated.query)),
  }
  for (const resource of ['branches','professionals','services','modules']) {
    controllers[`${resource}List`] = async (_req,res) => respond(res,await catalog.list(resource))
    controllers[`${resource}Get`] = async (req,res) => respond(res,await catalog.get(resource,req.params.id))
    controllers[`${resource}Create`] = async (req,res) => respond(res,await catalog.save(resource,req.body),201)
    controllers[`${resource}Edit`] = async (req,res) => respond(res,await catalog.save(resource,req.body,req.params.id))
    controllers[`${resource}Delete`] = async (req,res) => respond(res,await catalog.deactivate(resource,req.params.id))
  }
  return controllers
}
