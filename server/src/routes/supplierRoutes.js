import { Router } from 'express';
import * as supplierController from '../controllers/supplierController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', supplierController.list);
router.get('/:id', supplierController.getById);

router.post('/', requireRole('admin', 'manager'), idempotency, supplierController.create);
router.put('/:id', requireRole('admin', 'manager'), idempotency, supplierController.update);

export default router;
