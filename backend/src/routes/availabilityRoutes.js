import { Router } from 'express';
import { obtenerDisponibilidad } from '../controllers/availabilityController.js';
const router = Router();
router.get('/availability', obtenerDisponibilidad);
export default router;
