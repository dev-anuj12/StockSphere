import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
