import { Router } from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { idempotency } from '../middleware/idempotencyMiddleware.js';

const router = Router();

router.use(authenticate);

// Balance queries
router.get('/balances', inventoryController.getBalances);

// Stock In / Stock Out (Admin, Manager, Staff)
router.post('/stock-in', requireRole('admin', 'manager', 'staff'), idempotency, inventoryController.stockIn);
router.post('/stock-out', requireRole('admin', 'manager', 'staff'), idempotency, inventoryController.stockOut);

// Transfers & Adjustments (Admin, Manager only)
router.post('/transfer', requireRole('admin', 'manager'), idempotency, inventoryController.transfer);
router.post('/adjustment', requireRole('admin', 'manager'), idempotency, inventoryController.adjustment);

// Movement Ledger History
router.get('/movements', inventoryController.listMovements);
router.get('/movements/:id', inventoryController.getMovementById);

export default router;
