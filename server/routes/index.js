import { Router } from 'express'
import { endpoints } from './endpoints.js'
import { HttpError } from '../services/errors.js'

export function apiRoutes(controllers, auth) {
  const router = Router()
  for (const endpoint of endpoints) {
    router[endpoint.method](
      endpoint.path,
      (req, res, next) => {
        const publicRead = new Set([
          'health',
          'branchesList',
          'branchesGet',
          'servicesList',
          'servicesGet',
          'professionalsList',
          'professionalsGet',
          'availabilityGet',
          'availabilityWeekly',
        ])
        if (
          !publicRead.has(endpoint.action) &&
          endpoint.action !== 'bookingCreate'
        )
          auth.requireSession(req, res, () => {})
        if (!['GET', 'HEAD'].includes(req.method))
          auth.protectWrite(req, res, () => {})
        const academic =
          endpoint.path.startsWith('/tickets') ||
          endpoint.path.startsWith('/modules') ||
          /^(branches|professionals|services)(Create|Edit|Delete)$/.test(
            endpoint.action,
          ) ||
          ['availabilitySet', 'blockCreate', 'blockDelete'].includes(
            endpoint.action,
          )
        if (academic && !req.user?.isAdmin)
          throw new HttpError(
            403,
            'Esta operación pertenece a la extensión académica y requiere acceso administrativo.',
          )
        next()
      },
      (req, _res, next) => {
        req.validated = {}
        for (const field of ['params', 'query', 'body']) {
          if (!endpoint[field]) continue
          req.validated[field] = endpoint[field].parse(req[field])
          if (field === 'body') req.body = req.validated.body
        }
        next()
      },
      controllers[endpoint.action],
    )
  }
  return router
}
