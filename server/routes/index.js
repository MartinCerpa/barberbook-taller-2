import { Router } from 'express'
import { endpoints } from './endpoints.js'

export function apiRoutes(controllers) {
  const router = Router()
  for (const endpoint of endpoints) {
    router[endpoint.method](endpoint.path, (req,_res,next) => {
      req.validated = {}
      for (const field of ['params','query','body']) {
        if (!endpoint[field]) continue
        req.validated[field] = endpoint[field].parse(req[field])
        if (field === 'body') req.body = req.validated.body
      }
      next()
    }, controllers[endpoint.action])
  }
  return router
}
