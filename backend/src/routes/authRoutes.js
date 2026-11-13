import { Router } from 'express';
import { login, session, logout, requireSession, requireCsrf } from '../controllers/authController.js';
const router = Router();
router.post('/auth/login', login);
router.get('/auth/session', requireSession, session);
router.post('/auth/logout', requireSession, requireCsrf, logout);
export default router;
