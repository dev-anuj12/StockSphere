import { Router } from 'express';
import * as warehouseController from '../controllers/warehouseController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', warehouseController.list);
router.get('/:id', warehouseController.getById);

// Admin-only warehouse configuration
router.post('/', requireRole('admin'), idempotency, warehouseController.create);
router.put('/:id', requireRole('admin'), idempotency, warehouseController.update);

export default router;
