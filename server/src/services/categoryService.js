import * as categoryRepo from '../repositories/categoryRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

export async function listCategories() {
  return await categoryRepo.listCategories();
}

export async function getCategoryById(id) {
  const cat = await categoryRepo.findById(id);
  if (!cat) {
    throw new AppError('Category not found', 404);
  }
  return cat;
}

export async function createCategory(data, userId) {
  const existing = await categoryRepo.findByCode(data.code);
  if (existing) {
    throw new AppError(`Category with code '${data.code.toUpperCase()}' already exists.`, 409);
  }

  const category = await categoryRepo.createCategory(data);

  await auditRepo.logAction({
    userId,
    action: 'CREATE_CATEGORY',
    entityType: 'CATEGORY',
    entityId: category.id,
    newValues: category,
  });

  return category;
}

export async function updateCategory(id, updates, userId) {
  const existing = await categoryRepo.findById(id);
  if (!existing) {
    throw new AppError('Category not found', 404);
  }

  if (updates.code && updates.code.toUpperCase() !== existing.code.toUpperCase()) {
    const codeCheck = await categoryRepo.findByCode(updates.code);
    if (codeCheck && codeCheck.id !== id) {
      throw new AppError(`Category with code '${updates.code.toUpperCase()}' already exists.`, 409);
    }
  }

  // Prevent circular parent reference
  if (updates.parent_id && updates.parent_id === id) {
    throw new AppError('A category cannot be its own parent', 400);
  }

  const updated = await categoryRepo.updateCategory(id, updates);

  await auditRepo.logAction({
    userId,
    action: 'UPDATE_CATEGORY',
    entityType: 'CATEGORY',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}
