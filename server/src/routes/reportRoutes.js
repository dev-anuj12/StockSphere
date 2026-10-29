import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Reports are accessible to Admin & Manager
router.use(authenticate, requireRole('admin', 'manager'));

router.get('/', reportController.getReport);

export default router;
