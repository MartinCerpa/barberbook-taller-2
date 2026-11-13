import { Router } from 'express';

import {
  obtenerProfesionales,
  obtenerServicios
} from '../controllers/catalogController.js';

const router = Router();

router.get('/professionals', obtenerProfesionales);
router.get('/services', obtenerServicios);

export default router;