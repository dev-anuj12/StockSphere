import * as inventoryService from '../services/inventoryService.js';
import * as stockRepo from '../repositories/stockRepository.js';
import * as movementRepo from '../repositories/movementRepository.js';
import {
  stockInSchema,
  stockOutSchema,
  transferSchema,
  adjustmentSchema,
} from '../validators/stockValidator.js';
import { AppError } from '../utils/errors.js';

export async function getBalances(req, res, next) {
  try {
    const { productId, warehouseId, page = 1, limit = 20 } = req.query;
    const result = await stockRepo.listBalances({
      productId: productId || null,
      warehouseId: warehouseId || null,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function stockIn(req, res, next) {
  try {
    const validated = stockInSchema.parse(req.body);
    const result = await inventoryService.stockIn({
      productId: validated.product_id,
      warehouseId: validated.warehouse_id,
      quantity: validated.quantity,
      referenceNo: validated.reference_no,
      reason: validated.reason,
      notes: validated.notes,
      user: req.user,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function stockOut(req, res, next) {
  try {
    const validated = stockOutSchema.parse(req.body);
    const result = await inventoryService.stockOut({
      productId: validated.product_id,
      warehouseId: validated.warehouse_id,
      quantity: validated.quantity,
      referenceNo: validated.reference_no,
      reason: validated.reason,
      notes: validated.notes,
      user: req.user,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function transfer(req, res, next) {
  try {
    const validated = transferSchema.parse(req.body);
    const result = await inventoryService.transferStock({
      productId: validated.product_id,
      sourceWarehouseId: validated.source_warehouse_id,
      destinationWarehouseId: validated.destination_warehouse_id,
      quantity: validated.quantity,
      referenceNo: validated.reference_no,
      reason: validated.reason,
      notes: validated.notes,
      user: req.user,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function adjustment(req, res, next) {
  try {
    const validated = adjustmentSchema.parse(req.body);
    const result = await inventoryService.adjustStock({
      productId: validated.product_id,
      warehouseId: validated.warehouse_id,
      countedQuantity: validated.counted_quantity,
      reason: validated.reason,
      notes: validated.notes,
      user: req.user,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMovements(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      dateFrom,
      dateTo,
      productId,
      warehouseId,
      type,
    } = req.query;

    const allowedWarehouses = req.user.role === 'staff' ? req.user.warehouses : null;

    const result = await movementRepo.listMovements({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      productId: productId || null,
      warehouseId: warehouseId || null,
      type: type || null,
      allowedWarehouses,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMovementById(req, res, next) {
  try {
    const movement = await movementRepo.findById(req.params.id);
    if (!movement) {
      throw new AppError('Inventory movement ledger record not found', 404);
    }

    if (req.user.role === 'staff' && !req.user.warehouses?.includes(movement.warehouse_id)) {
      throw new AppError('Access denied to view movements for this warehouse', 403);
    }

    res.status(200).json(movement);
  } catch (err) {
    next(err);
  }
}
