import { Router } from 'express';
import * as categoryController from '../controllers/categoryController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', categoryController.list);
router.get('/:id', categoryController.getById);

router.post('/', requireRole('admin', 'manager'), idempotency, categoryController.create);
router.put('/:id', requireRole('admin', 'manager'), idempotency, categoryController.update);

export default router;
