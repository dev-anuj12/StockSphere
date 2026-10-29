import * as warehouseService from '../services/warehouseService.js';
import { createWarehouseSchema, updateWarehouseSchema } from '../validators/warehouseValidator.js';

export async function list(req, res, next) {
  try {
    const status = req.query.status || 'active';
    const warehouses = await warehouseService.listWarehouses(status === 'all' ? null : status);
    res.status(200).json({ data: warehouses });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const warehouse = await warehouseService.getWarehouseById(req.params.id);
    res.status(200).json(warehouse);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const validated = createWarehouseSchema.parse(req.body);
    const warehouse = await warehouseService.createWarehouse(validated, req.user.id);
    res.status(201).json(warehouse);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const validated = updateWarehouseSchema.parse(req.body);
    const updated = await warehouseService.updateWarehouse(req.params.id, validated, req.user.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
