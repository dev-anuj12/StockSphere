import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/autocomplete', productController.autocomplete);
router.get('/', productController.list);
router.get('/:id', productController.getById);

// Admin & Manager write endpoints
router.post('/', requireRole('admin', 'manager'), idempotency, productController.create);
router.put('/:id', requireRole('admin', 'manager'), idempotency, productController.update);
router.delete('/:id', requireRole('admin', 'manager'), idempotency, productController.remove);

export default router;
