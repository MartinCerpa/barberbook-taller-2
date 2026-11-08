import { Router } from 'express'
import { z } from 'zod'
import { professionalService } from '../services/professionalService.js'
import { bookingService } from '../services/bookingService.js'
import { availabilityService } from '../services/availabilityService.js'
import { dateId, time, id } from '../validations/schemas.js'
export function professionalRoutes(pool, auth) {
  const router = Router(),
    service = professionalService(pool),
    bookings = bookingService(pool),
    availability = availabilityService(pool)
  router.use(auth.requireSession, auth.protectWrite)
  const reply = (res, data) => res.json({ data })
  router.get('/state', async (req, res) =>
    reply(res, await service.state(req.user.professionalId)),
  )
  router.put('/preferences', async (req, res) =>
    reply(res, await service.preferences(req.user.professionalId, req.body)),
  )
  router.put('/hours', async (req, res) =>
    reply(res, await service.hours(req.user.professionalId, req.body)),
  )
  router.put('/profile', async (req, res) =>
    reply(res, await service.profile(req.user.professionalId, req.body)),
  )
  router.delete('/profile', async (req, res) =>
    reply(res, await service.restoreProfile(req.user.professionalId)),
  )
  router.put('/services', async (req, res) =>
    reply(res, await service.services(req.user.professionalId, req.body)),
  )
  router.post('/services/restore', async (req, res) =>
    reply(res, await service.restoreServices(req.user.professionalId)),
  )
  router.patch('/customers/:id/trust', async (req, res) =>
    reply(
      res,
      await service.trust(
        req.user.professionalId,
        id.parse(req.params.id),
        z
          .enum(['normal', 'requires_manual_approval'])
          .parse(req.body.trustStatus),
      ),
    ),
  )
  router.post('/undo', async (req, res) =>
    reply(
      res,
      await bookings.undo(
        z.uuid().parse(req.body.token),
        req.user.professionalId,
      ),
    ),
  )
  router.put('/slots', async (req, res) => {
    const input = z
      .object({
        date: dateId,
        time,
        action: z.enum(['block', 'unblock', 'enable', 'restore']),
      })
      .strict()
      .parse(req.body)
    let result
    if (input.action === 'block')
      result = await availability.block({
        professionalId: req.user.professionalId,
        dateId: input.date,
        time: input.time,
        duration: 60,
      })
    else if (input.action === 'unblock') {
      const block = (
        await pool.query(
          "SELECT id FROM availability_blocks WHERE professional_id=$1 AND starts_at=($2::timestamp AT TIME ZONE 'America/Santiago')",
          [req.user.professionalId, `${input.date} ${input.time}:00`],
        )
      ).rows[0]
      result = block ? await availability.unblock(block.id) : { restored: true }
    } else
      result = await service.exception(
        req.user.professionalId,
        input.date,
        input.time,
        input.action === 'restore',
      )
    reply(res, result)
  })
  return router
}
