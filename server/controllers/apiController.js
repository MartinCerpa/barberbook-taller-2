import { catalogRepository } from '../repositories/catalogRepository.js'
import { bookingService } from '../services/bookingService.js'
import { availabilityService } from '../services/availabilityService.js'
import { ticketService } from '../services/ticketService.js'
import { metricsService } from '../services/metricsService.js'
import {
  professionalService,
  profileView,
} from '../services/professionalService.js'
import { HttpError, requireFound } from '../services/errors.js'

export function createControllers({ pool, mongo }, events) {
  const catalog = catalogRepository(pool)
  const bookings = bookingService(pool)
  const availability = availabilityService(pool)
  const tickets = ticketService(pool)
  const metrics = metricsService(pool)
  const professional = professionalService(pool)
  const assertPublic = async (req, id) => {
    const p = requireFound(
      (
        await pool.query('SELECT * FROM professionals WHERE id=$1 AND active', [
          id,
        ])
      ).rows[0],
    )
    if (
      !p.public_visible &&
      !req.user?.isAdmin &&
      req.user?.professionalId !== id
    )
      throw new HttpError(404, 'Profesional no disponible.')
    return p
  }
  const respond = (res, data, status = 200) => res.status(status).json({ data })
  const controllers = {
    health: async (_req, res) => {
      await pool.query('SELECT 1')
      await mongo.db().command({ ping: 1 })
      const pending = Number(
        (
          await pool.query(
            'SELECT COUNT(*) FROM event_outbox WHERE delivered_at IS NULL',
          )
        ).rows[0].count,
      )
      respond(res, {
        status: 'ok',
        postgres: 'connected',
        mongo: 'connected',
        pendingEvents: pending,
      })
    },
    bookingList: async (req, res) =>
      respond(
        res,
        await bookings.list({
          ...req.validated.query,
          ...(!req.user.isAdmin
            ? { professionalId: req.user.professionalId }
            : {}),
        }),
      ),
    bookingGet: async (req, res) =>
      respond(
        res,
        await bookings.get(
          req.params.id,
          req.user.isAdmin ? undefined : req.user.professionalId,
        ),
      ),
    bookingCreate: async (req, res) => {
      await assertPublic(req, req.body.professionalId)
      const result = await bookings.create(req.body)
      respond(res, result.booking, result.created ? 201 : 200)
    },
    bookingStatus: async (req, res) =>
      respond(
        res,
        await bookings.status(
          req.params.id,
          req.body.status,
          req.user.isAdmin ? undefined : req.user.professionalId,
        ),
      ),
    bookingEdit: async (req, res) =>
      respond(
        res,
        await bookings.edit(
          req.params.id,
          req.body,
          req.user.isAdmin ? undefined : req.user.professionalId,
        ),
      ),
    availabilityGet: async (req, res) => {
      const q = req.validated.query
      await assertPublic(req, q.professionalId)
      respond(
        res,
        await availability.get(
          q.professionalId,
          q.serviceId,
          q.startDate,
          q.days,
        ),
      )
    },
    availabilityWeekly: async (req, res) => {
      await assertPublic(req, req.validated.query.professionalId)
      respond(
        res,
        await availability.weekly(req.validated.query.professionalId),
      )
    },
    availabilitySet: async (req, res) =>
      respond(res, await availability.set(req.body)),
    blockList: async (req, res) =>
      respond(
        res,
        await availability.blocks(
          req.user.isAdmin ? undefined : req.user.professionalId,
        ),
      ),
    blockCreate: async (req, res) =>
      respond(res, await availability.block(req.body), 201),
    blockDelete: async (req, res) =>
      respond(res, await availability.unblock(req.params.id)),
    ticketList: async (req, res) =>
      respond(res, await tickets.list(req.validated.query)),
    ticketGet: async (req, res) =>
      respond(res, await tickets.get(req.params.id)),
    ticketCreate: async (req, res) => {
      const result = await tickets.create(req.body)
      respond(res, result.ticket, result.created ? 201 : 200)
    },
    ticketNext: async (req, res) =>
      respond(res, await tickets.next(req.body.moduleId)),
    ticketStatus: async (req, res) =>
      respond(res, await tickets.status(req.params.id, req.body.status)),
    metrics: async (req, res) =>
      respond(
        res,
        req.user.isAdmin
          ? await metrics.summary(req.validated.query.branchId)
          : (await professional.state(req.user.professionalId)).financial,
      ),
    customers: async (req, res) =>
      respond(
        res,
        req.user.isAdmin
          ? await metrics.customers()
          : (await professional.state(req.user.professionalId)).customers,
      ),
    history: async (req, res) =>
      respond(
        res,
        req.user.isAdmin
          ? await metrics.history(req.validated.query.limit)
          : (await professional.state(req.user.professionalId)).records
              .filter((r) =>
                [
                  'completed',
                  'cancelled',
                  'no_show',
                  'rejected',
                  'expired',
                ].includes(r.status),
              )
              .slice(0, req.validated.query.limit),
      ),
    events: async (req, res) => {
      const ids = req.user.isAdmin
        ? undefined
        : (
            await pool.query(
              'SELECT id FROM bookings WHERE professional_id=$1',
              [req.user.professionalId],
            )
          ).rows.map((r) => r.id)
      respond(
        res,
        await events.list({ ...req.validated.query, entityIds: ids }),
      )
    },
  }
  for (const resource of ['branches', 'professionals', 'services', 'modules']) {
    controllers[`${resource}List`] = async (_req, res) =>
      respond(res, await catalog.list(resource))
    controllers[`${resource}Get`] = async (req, res) =>
      respond(res, await catalog.get(resource, req.params.id))
    controllers[`${resource}Create`] = async (req, res) =>
      respond(res, await catalog.save(resource, req.body), 201)
    controllers[`${resource}Edit`] = async (req, res) =>
      respond(res, await catalog.save(resource, req.body, req.params.id))
    controllers[`${resource}Delete`] = async (req, res) =>
      respond(res, await catalog.deactivate(resource, req.params.id))
  }
  controllers.professionalsList = async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM professionals WHERE active AND (public_visible OR id=$1 OR $2) ORDER BY (id='professional-matias') DESC,name",
      [req.user?.professionalId || '', req.user?.isAdmin || false],
    )
    respond(res, rows.map(profileView))
  }
  controllers.professionalsGet = async (req, res) =>
    respond(res, profileView(await assertPublic(req, req.params.id)))
  controllers.servicesList = async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.* FROM services s JOIN professionals p ON p.id=s.professional_id WHERE (p.public_visible AND p.active AND s.active) OR p.id=$1 OR $2 ORDER BY s.name`,
      [req.user?.professionalId || '', req.user?.isAdmin || false],
    )
    respond(res, rows.map(camelCatalog))
  }
  controllers.servicesGet = async (req, res) => {
    const row = requireFound(
      (await pool.query('SELECT * FROM services WHERE id=$1', [req.params.id]))
        .rows[0],
    )
    await assertPublic(req, row.professional_id)
    respond(res, camelCatalog(row))
  }
  controllers.branchesList = async (req, res) =>
    respond(
      res,
      (
        await pool.query(
          'SELECT DISTINCT b.* FROM branches b JOIN professionals p ON p.branch_id=b.id WHERE b.active AND (p.public_visible OR p.id=$1 OR $2)',
          [req.user?.professionalId || '', req.user?.isAdmin || false],
        )
      ).rows,
    )
  controllers.branchesGet = async (req, res) => {
    const b = requireFound(
      (
        await pool.query(
          'SELECT b.* FROM branches b WHERE b.id=$1 AND EXISTS(SELECT 1 FROM professionals p WHERE p.branch_id=b.id AND (p.public_visible OR p.id=$2 OR $3))',
          [
            req.params.id,
            req.user?.professionalId || '',
            req.user?.isAdmin || false,
          ],
        )
      ).rows[0],
    )
    respond(res, b)
  }
  return controllers
}
const camelCatalog = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v,
    ]),
  )
