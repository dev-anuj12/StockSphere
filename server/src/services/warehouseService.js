import * as warehouseRepo from '../repositories/warehouseRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

export async function listWarehouses(status = 'active') {
  return await warehouseRepo.listWarehouses(status);
}

export async function getWarehouseById(id) {
  const wh = await warehouseRepo.findById(id);
  if (!wh) {
    throw new AppError('Warehouse not found', 404);
  }
  return wh;
}

export async function createWarehouse(data, userId) {
  const existing = await warehouseRepo.findByCode(data.code);
  if (existing) {
    throw new AppError(`Warehouse with code '${data.code.toUpperCase()}' already exists.`, 409);
  }

  const warehouse = await warehouseRepo.createWarehouse(data);

  await auditRepo.logAction({
    userId,
    action: 'CREATE_WAREHOUSE',
    entityType: 'WAREHOUSE',
    entityId: warehouse.id,
    newValues: warehouse,
  });

  return warehouse;
}

export async function updateWarehouse(id, updates, userId) {
  const existing = await warehouseRepo.findById(id);
  if (!existing) {
    throw new AppError('Warehouse not found', 404);
  }

  if (updates.code && updates.code.toUpperCase() !== existing.code.toUpperCase()) {
    const codeCheck = await warehouseRepo.findByCode(updates.code);
    if (codeCheck && codeCheck.id !== id) {
      throw new AppError(`Warehouse with code '${updates.code.toUpperCase()}' already exists.`, 409);
    }
  }

  const updated = await warehouseRepo.updateWarehouse(id, updates);

  await auditRepo.logAction({
    userId,
    action: 'UPDATE_WAREHOUSE',
    entityType: 'WAREHOUSE',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}
