import * as supplierRepo from '../repositories/supplierRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

export async function listSuppliers(status = 'active') {
  return await supplierRepo.listSuppliers(status);
}

export async function getSupplierById(id) {
  const sup = await supplierRepo.findById(id);
  if (!sup) {
    throw new AppError('Supplier not found', 404);
  }
  return sup;
}

export async function createSupplier(data, userId) {
  const existing = await supplierRepo.findByCode(data.code);
  if (existing) {
    throw new AppError(`Supplier with code '${data.code.toUpperCase()}' already exists.`, 409);
  }

  const supplier = await supplierRepo.createSupplier(data);

  await auditRepo.logAction({
    userId,
    action: 'CREATE_SUPPLIER',
    entityType: 'SUPPLIER',
    entityId: supplier.id,
    newValues: supplier,
  });

  return supplier;
}

export async function updateSupplier(id, updates, userId) {
  const existing = await supplierRepo.findById(id);
  if (!existing) {
    throw new AppError('Supplier not found', 404);
  }

  if (updates.code && updates.code.toUpperCase() !== existing.code.toUpperCase()) {
    const codeCheck = await supplierRepo.findByCode(updates.code);
    if (codeCheck && codeCheck.id !== id) {
      throw new AppError(`Supplier with code '${updates.code.toUpperCase()}' already exists.`, 409);
    }
  }

  const updated = await supplierRepo.updateSupplier(id, updates);

  await auditRepo.logAction({
    userId,
    action: 'UPDATE_SUPPLIER',
    entityType: 'SUPPLIER',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}
