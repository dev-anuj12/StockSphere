import * as productRepo from '../repositories/productRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

export async function listProducts(params) {
  return await productRepo.listProducts(params);
}

export async function getProductById(id) {
  const product = await productRepo.findById(id);
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  return product;
}

export async function createProduct(data, userId) {
  // Check SKU uniqueness
  const existing = await productRepo.findBySku(data.sku);
  if (existing) {
    throw new AppError(`A product with SKU '${data.sku.toUpperCase()}' already exists.`, 409);
  }

  const product = await productRepo.createProduct(data);

  await auditRepo.logAction({
    userId,
    action: 'CREATE_PRODUCT',
    entityType: 'PRODUCT',
    entityId: product.id,
    newValues: product,
  });

  return product;
}

export async function updateProduct(id, updates, userId) {
  const existing = await productRepo.findById(id);
  if (!existing) {
    throw new AppError('Product not found', 404);
  }

  // If SKU is being updated, verify uniqueness
  if (updates.sku && updates.sku.toUpperCase() !== existing.sku.toUpperCase()) {
    const skuCheck = await productRepo.findBySku(updates.sku);
    if (skuCheck && skuCheck.id !== id) {
      throw new AppError(`A product with SKU '${updates.sku.toUpperCase()}' already exists.`, 409);
    }
  }

  const updated = await productRepo.updateProduct(id, updates);

  await auditRepo.logAction({
    userId,
    action: 'UPDATE_PRODUCT',
    entityType: 'PRODUCT',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}

export async function deleteOrArchiveProduct(id, userId) {
  const product = await productRepo.findById(id);
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const hasHistory = await productRepo.hasMovementHistory(id);

  if (hasHistory) {
    const archived = await productRepo.archiveProduct(id);
    await auditRepo.logAction({
      userId,
      action: 'ARCHIVE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      newValues: { status: 'archived', archived_at: archived.archived_at },
    });
    return {
      action: 'archived',
      message: `Product '${product.name}' (${product.sku}) has movement history and has been safely archived.`,
      product: archived,
    };
  } else {
    await productRepo.hardDeleteProduct(id);
    await auditRepo.logAction({
      userId,
      action: 'DELETE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: product,
    });
    return {
      action: 'deleted',
      message: `Product '${product.name}' (${product.sku}) has been permanently deleted.`,
    };
  }
}

export async function searchAutocomplete(q) {
  if (!q || q.trim() === '') return [];
  return await productRepo.searchAutocomplete(q.trim());
}
