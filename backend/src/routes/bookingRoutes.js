import { Router } from 'express';
import { registrarReserva } from '../controllers/bookingController.js';

const router = Router();

router.post('/bookings', registrarReserva);

export default router;