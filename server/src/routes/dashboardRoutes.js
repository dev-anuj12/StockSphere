import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/stats', dashboardController.getStats);
router.get('/recent-movements', dashboardController.getRecentMovements);
router.get('/low-stock', dashboardController.getLowStock);
router.get('/charts', dashboardController.getCharts);

export default router;
