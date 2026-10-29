import { getClient } from '../config/db.js';
import * as stockRepo from '../repositories/stockRepository.js';
import * as movementRepo from '../repositories/movementRepository.js';
import * as productRepo from '../repositories/productRepository.js';
import * as warehouseRepo from '../repositories/warehouseRepository.js';
import { checkWarehouseAccess } from '../middleware/authMiddleware.js';
import { AppError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validates that product and warehouse exist and are active, and checks user's access
 */
async function validatePrerequisites(client, productId, warehouseId, user, warehouseLabel = 'warehouse') {
  // Check product
  const prodRes = await client.query(`
    SELECT id, sku, name, cost_price, status
    FROM products WHERE id = $1
  `, [productId]);

  if (prodRes.rows.length === 0) {
    throw new AppError('Product not found', 404);
  }
  const product = prodRes.rows[0];
  if (product.status !== 'active') {
    throw new AppError(`Product '${product.name}' (${product.sku}) is archived and cannot undergo stock operations`, 400);
  }

  // Check warehouse
  const whRes = await client.query(`
    SELECT id, name, code, status
    FROM warehouses WHERE id = $1
  `, [warehouseId]);

  if (whRes.rows.length === 0) {
    throw new AppError(`The selected ${warehouseLabel} was not found`, 404);
  }
  const warehouse = whRes.rows[0];
  if (warehouse.status !== 'active') {
    throw new AppError(`Warehouse '${warehouse.name}' is inactive and cannot undergo stock operations`, 400);
  }

  // Check permission
  if (!checkWarehouseAccess(user, warehouseId)) {
    throw new AppError(`You do not have authorization to perform stock operations in warehouse '${warehouse.name}'`, 403);
  }

  return { product, warehouse };
}

/**
 * Stock In:
 * Inserts or increments balance inside a transaction, then records IN movement ledger entry.
 */
export async function stockIn({ productId, warehouseId, quantity, referenceNo, reason, notes, user }) {
  if (quantity <= 0) {
    throw new AppError('Stock In quantity must be a positive integer', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { product, warehouse } = await validatePrerequisites(client, productId, warehouseId, user);

    // Atomic Upsert
    const newBalance = await stockRepo.upsertStockIn(client, productId, warehouseId, quantity);

    // Insert Movement Ledger Row
    const movement = await movementRepo.insertMovement(client, {
      type: 'IN',
      productId,
      warehouseId,
      quantityChange: quantity,
      balanceAfter: newBalance,
      unitCost: product.cost_price,
      referenceNo: referenceNo || null,
      reason: reason || 'Stock In',
      notes: notes || null,
      userId: user ? user.id : null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      operation: 'STOCK_IN',
      product_id: productId,
      product_name: product.name,
      warehouse_id: warehouseId,
      warehouse_name: warehouse.name,
      quantity_added: quantity,
      new_balance: newBalance,
      movement_id: movement.id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Stock Out:
 * Atomically decrements balance if available >= qty. If insufficient, rejects with 409 and available qty.
 */
export async function stockOut({ productId, warehouseId, quantity, referenceNo, reason, notes, user }) {
  if (quantity <= 0) {
    throw new AppError('Stock Out quantity must be a positive integer', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { product, warehouse } = await validatePrerequisites(client, productId, warehouseId, user);

    // Attempt atomic decrement
    const newBalance = await stockRepo.updateStockOut(client, productId, warehouseId, quantity);

    if (newBalance === null) {
      // Query current balance to return exact available amount
      const balRes = await client.query(`
        SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
      `, [productId, warehouseId]);
      const available = balRes.rows.length > 0 ? balRes.rows[0].quantity : 0;

      throw new AppError(
        `Insufficient stock for product '${product.name}' in warehouse '${warehouse.name}'. Requested: ${quantity}, Available: ${available}`,
        409,
        { requested: quantity, available, productId, warehouseId }
      );
    }

    // Insert Movement Ledger Row
    const movement = await movementRepo.insertMovement(client, {
      type: 'OUT',
      productId,
      warehouseId,
      quantityChange: -quantity, // negative signed change for OUT
      balanceAfter: newBalance,
      unitCost: product.cost_price,
      referenceNo: referenceNo || null,
      reason: reason || 'Stock Out',
      notes: notes || null,
      userId: user ? user.id : null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      operation: 'STOCK_OUT',
      product_id: productId,
      product_name: product.name,
      warehouse_id: warehouseId,
      warehouse_name: warehouse.name,
      quantity_removed: quantity,
      new_balance: newBalance,
      movement_id: movement.id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Stock Transfer:
 * Two-phase balance lock in ascending warehouse_id order to prevent deadlocks.
 * Decrements source, increments destination, and records 2 linked ledger entries sharing transfer_id.
 */
export async function transferStock({ productId, sourceWarehouseId, destinationWarehouseId, quantity, referenceNo, reason, notes, user }) {
  if (sourceWarehouseId === destinationWarehouseId) {
    throw new AppError('Source and destination warehouses cannot be the same', 400);
  }

  if (quantity <= 0) {
    throw new AppError('Transfer quantity must be a positive integer', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { product, warehouse: sourceWh } = await validatePrerequisites(client, productId, sourceWarehouseId, user, 'source warehouse');
    const { warehouse: destWh } = await validatePrerequisites(client, productId, destinationWarehouseId, user, 'destination warehouse');

    // Ensure destination balance row exists first
    await client.query(`
      INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
      VALUES ($1, $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, warehouse_id) DO NOTHING
    `, [productId, destinationWarehouseId]);

    // Ensure source balance row exists
    await client.query(`
      INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
      VALUES ($1, $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, warehouse_id) DO NOTHING
    `, [productId, sourceWarehouseId]);

    // Deadlock-free locking: Lock both rows in ascending UUID order
    const orderedWhIds = [sourceWarehouseId, destinationWarehouseId].sort();
    await client.query(`
      SELECT warehouse_id, quantity
      FROM stock_balances
      WHERE product_id = $1 AND warehouse_id IN ($2, $3)
      ORDER BY warehouse_id ASC
      FOR UPDATE
    `, [productId, orderedWhIds[0], orderedWhIds[1]]);

    // Re-check source balance under lock
    const srcBalRes = await client.query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [productId, sourceWarehouseId]);
    const currentSourceQty = srcBalRes.rows[0].quantity;

    if (currentSourceQty < quantity) {
      throw new AppError(
        `Insufficient stock in source warehouse '${sourceWh.name}'. Requested: ${quantity}, Available: ${currentSourceQty}`,
        409,
        { requested: quantity, available: currentSourceQty }
      );
    }

    // Decrement source
    const newSourceQty = currentSourceQty - quantity;
    await client.query(`
      UPDATE stock_balances
      SET quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2 AND warehouse_id = $3
    `, [newSourceQty, productId, sourceWarehouseId]);

    // Increment destination
    const destBalRes = await client.query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [productId, destinationWarehouseId]);
    const newDestQty = destBalRes.rows[0].quantity + quantity;

    await client.query(`
      UPDATE stock_balances
      SET quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2 AND warehouse_id = $3
    `, [newDestQty, productId, destinationWarehouseId]);

    // Generate shared transfer_id
    const transferId = uuidv4();

    // 1. Source Leg (OUT)
    const sourceMovement = await movementRepo.insertMovement(client, {
      type: 'TRANSFER',
      productId,
      warehouseId: sourceWarehouseId,
      quantityChange: -quantity,
      balanceAfter: newSourceQty,
      unitCost: product.cost_price,
      transferId,
      referenceNo: referenceNo || `TRF-${Date.now()}`,
      reason: reason || `Transfer out to ${destWh.name}`,
      notes: notes || null,
      userId: user ? user.id : null,
    });

    // 2. Destination Leg (IN)
    const destMovement = await movementRepo.insertMovement(client, {
      type: 'TRANSFER',
      productId,
      warehouseId: destinationWarehouseId,
      quantityChange: quantity,
      balanceAfter: newDestQty,
      unitCost: product.cost_price,
      transferId,
      referenceNo: referenceNo || `TRF-${Date.now()}`,
      reason: reason || `Transfer in from ${sourceWh.name}`,
      notes: notes || null,
      userId: user ? user.id : null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      operation: 'TRANSFER',
      transfer_id: transferId,
      product_id: productId,
      product_name: product.name,
      source_warehouse: { id: sourceWarehouseId, name: sourceWh.name, new_balance: newSourceQty },
      destination_warehouse: { id: destinationWarehouseId, name: destWh.name, new_balance: newDestQty },
      quantity_transferred: quantity,
      movements: [sourceMovement.id, destMovement.id],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Stock Adjustment:
 * Server recomputes difference = counted - current inside transaction.
 * Writes an ADJUSTMENT movement with signed difference.
 */
export async function adjustStock({ productId, warehouseId, countedQuantity, reason, notes, user }) {
  if (countedQuantity < 0) {
    throw new AppError('Counted quantity cannot be negative', 400);
  }

  if (!reason || reason.trim().length < 3) {
    throw new AppError('A valid adjustment reason is strictly required (minimum 3 characters)', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { product, warehouse } = await validatePrerequisites(client, productId, warehouseId, user);

    // Lock balance row
    await client.query(`
      INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
      VALUES ($1, $2, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, warehouse_id) DO NOTHING
    `, [productId, warehouseId]);

    const balRes = await client.query(`
      SELECT quantity FROM stock_balances
      WHERE product_id = $1 AND warehouse_id = $2
      FOR UPDATE
    `, [productId, warehouseId]);

    const currentQty = balRes.rows[0].quantity;
    const difference = countedQuantity - currentQty;

    if (difference === 0) {
      await client.query('COMMIT');
      return {
        success: true,
        operation: 'ADJUSTMENT',
        message: 'Counted quantity equals current balance. No adjustment required.',
        previous_balance: currentQty,
        new_balance: currentQty,
        quantity_change: 0,
      };
    }

    // Update stock balance
    await client.query(`
      UPDATE stock_balances
      SET quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2 AND warehouse_id = $3
    `, [countedQuantity, productId, warehouseId]);

    // Record ADJUSTMENT movement
    const movement = await movementRepo.insertMovement(client, {
      type: 'ADJUSTMENT',
      productId,
      warehouseId,
      quantityChange: difference, // signed difference
      balanceAfter: countedQuantity,
      unitCost: product.cost_price,
      referenceNo: `ADJ-${Date.now()}`,
      reason: reason.trim(),
      notes: notes || `Physical count changed from ${currentQty} to ${countedQuantity} (diff: ${difference > 0 ? '+' : ''}${difference})`,
      userId: user ? user.id : null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      operation: 'ADJUSTMENT',
      product_id: productId,
      product_name: product.name,
      warehouse_id: warehouseId,
      warehouse_name: warehouse.name,
      previous_balance: currentQty,
      counted_quantity: countedQuantity,
      quantity_change: difference,
      movement_id: movement.id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
