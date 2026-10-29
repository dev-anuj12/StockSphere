import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

// Strictly Admin Only
router.use(authenticate, requireRole('admin'));

router.get('/', userController.list);
router.post('/', idempotency, userController.create);
router.put('/:id', idempotency, userController.update);
router.patch('/:id/status', idempotency, userController.updateStatus);

export default router;
