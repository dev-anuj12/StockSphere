import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { query, closeDb } from '../src/config/db.js';

let adminToken = '';
let managerToken = '';
let staff1Token = '';
let testProductId = '';
let testWarehouseMdcId = '';
let testWarehouseWchId = '';
let testWarehouseEcdId = '';

beforeAll(async () => {
  await seed();

  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'Admin@StockSphere2026!' });
  adminToken = adminRes.body.token;

  const managerRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'manager', password: 'Manager@StockSphere2026!' });
  managerToken = managerRes.body.token;

  const staffRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'staff1', password: 'Staff@StockSphere2026!' });
  staff1Token = staffRes.body.token;

  const prodRes = await request(app)
    .get('/api/products?search=SKU-MBA13')
    .set('Authorization', `Bearer ${adminToken}`);
  testProductId = prodRes.body.data[0].id;

  const whRes = await request(app)
    .get('/api/warehouses')
    .set('Authorization', `Bearer ${adminToken}`);

  testWarehouseMdcId = whRes.body.data.find(w => w.code === 'WH-MDC').id;
  testWarehouseWchId = whRes.body.data.find(w => w.code === 'WH-WCH').id;
  testWarehouseEcdId = whRes.body.data.find(w => w.code === 'WH-ECD').id;
});

afterAll(async () => {
  await closeDb();
});

describe('Transfer Consistency & Rollback on Failure', () => {
  it('should transfer stock between warehouses and write two linked ledger rows sharing a transfer_id', async () => {
    // Current balances for MBA13: MDC = 25, WCH = 15
    const res = await request(app)
      .post('/api/inventory/transfer')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        product_id: testProductId,
        source_warehouse_id: testWarehouseMdcId,
        destination_warehouse_id: testWarehouseWchId,
        quantity: 5,
        reference_no: 'TRF-TEST-001',
        reason: 'West coast stock rebalance',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transfer_id).toBeDefined();
    expect(res.body.source_warehouse.new_balance).toBe(20);
    expect(res.body.destination_warehouse.new_balance).toBe(20);

    // Verify 2 linked ledger rows exist with shared transfer_id
    const movRes = await query(`
      SELECT * FROM inventory_movements WHERE transfer_id = $1
    `, [res.body.transfer_id]);

    expect(movRes.rows.length).toBe(2);
    const sourceLeg = movRes.rows.find(r => r.quantity_change < 0);
    const destLeg = movRes.rows.find(r => r.quantity_change > 0);

    expect(sourceLeg.quantity_change).toBe(-5);
    expect(destLeg.quantity_change).toBe(5);
  });

  it('should rollback transaction and leave balances untouched if transfer quantity exceeds source balance', async () => {
    const prevSrc = await query(`SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2`, [testProductId, testWarehouseMdcId]);
    const prevDest = await query(`SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2`, [testProductId, testWarehouseWchId]);

    const res = await request(app)
      .post('/api/inventory/transfer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_id: testProductId,
        source_warehouse_id: testWarehouseMdcId,
        destination_warehouse_id: testWarehouseWchId,
        quantity: 999999, // Exceeds available
      });

    expect(res.status).toBe(409);

    // Assert balances did not change
    const afterSrc = await query(`SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2`, [testProductId, testWarehouseMdcId]);
    const afterDest = await query(`SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2`, [testProductId, testWarehouseWchId]);

    expect(afterSrc.rows[0].quantity).toBe(prevSrc.rows[0].quantity);
    expect(afterDest.rows[0].quantity).toBe(prevDest.rows[0].quantity);
  });
});

describe('Physical Stock Adjustment Calculation', () => {
  it('should recompute difference server-side and record signed ADJUSTMENT movement', async () => {
    // Current MDC balance is 20
    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseMdcId,
        counted_quantity: 23, // 3 surplus units
        reason: 'Quarterly Physical Count Audit',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.previous_balance).toBe(20);
    expect(res.body.counted_quantity).toBe(23);
    expect(res.body.quantity_change).toBe(3);

    // Verify ledger row
    const movRes = await query(`SELECT * FROM inventory_movements WHERE id = $1`, [res.body.movement_id]);
    expect(movRes.rows[0].type).toBe('ADJUSTMENT');
    expect(movRes.rows[0].quantity_change).toBe(3);
    expect(movRes.rows[0].balance_after).toBe(23);
  });
});

describe('Idempotency Key Enforcement', () => {
  it('repeating an Idempotency-Key returns original result without applying change twice', async () => {
    const idempotencyKey = `idemp-test-${Date.now()}`;

    // First call: Stock In 5 units
    const firstRes = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseMdcId,
        quantity: 5,
        reference_no: 'IDEMP-TEST-01',
      });

    expect(firstRes.status).toBe(200);
    const balanceAfterFirst = firstRes.body.new_balance;

    // Second call: Same Idempotency-Key
    const secondRes = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseMdcId,
        quantity: 5,
        reference_no: 'IDEMP-TEST-01',
      });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.new_balance).toBe(balanceAfterFirst);

    // Assert database balance only increased once
    const dbBal = await query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [testProductId, testWarehouseMdcId]);

    expect(dbBal.rows[0].quantity).toBe(balanceAfterFirst);
  });
});

describe('Ledger Immutability Trigger', () => {
  it('should strictly reject UPDATE on inventory_movements via trigger exception', async () => {
    const mov = await query(`SELECT id FROM inventory_movements LIMIT 1`);
    const movId = mov.rows[0].id;

    await expect(
      query(`UPDATE inventory_movements SET quantity_change = 999 WHERE id = $1`, [movId])
    ).rejects.toThrow(/immutable append-only ledger entries/i);
  });

  it('should strictly reject DELETE on inventory_movements via trigger exception', async () => {
    const mov = await query(`SELECT id FROM inventory_movements LIMIT 1`);
    const movId = mov.rows[0].id;

    await expect(
      query(`DELETE FROM inventory_movements WHERE id = $1`, [movId])
    ).rejects.toThrow(/immutable append-only ledger entries/i);
  });
});

describe('Concurrency Testing: 50 Parallel Stock-Outs', () => {
  it('should handle 50 concurrent stock-outs without balance going negative and maintain ledger sum invariant', async () => {
    // Current balance of MBA13 in MDC is around 28
    const balRes = await query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [testProductId, testWarehouseMdcId]);
    const initialQty = balRes.rows[0].quantity;

    // Fire 50 parallel requests each attempting to decrement 1 unit
    const requests = Array.from({ length: 50 }).map((_, i) =>
      request(app)
        .post('/api/inventory/stock-out')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          product_id: testProductId,
          warehouse_id: testWarehouseMdcId,
          quantity: 1,
          reference_no: `CONCURRENCY-${i}`,
          reason: 'Concurrency Stress Test',
        })
    );

    const results = await Promise.all(requests);

    const successful = results.filter(r => r.status === 200).length;
    const conflicts = results.filter(r => r.status === 409).length;

    // Number of successful debits must exactly equal the available initialQty (since 50 > initialQty)
    expect(successful).toBe(initialQty);
    expect(conflicts).toBe(50 - initialQty);

    // Assert final balance is exactly 0 and NEVER negative!
    const finalBal = await query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [testProductId, testWarehouseMdcId]);
    expect(finalBal.rows[0].quantity).toBe(0);

    // Verify invariant: SUM(quantity_change) == 0
    const invRes = await query(`
      SELECT COALESCE(SUM(quantity_change), 0)::INT as total
      FROM inventory_movements
      WHERE product_id = $1 AND warehouse_id = $2
    `, [testProductId, testWarehouseMdcId]);
    expect(invRes.rows[0].total).toBe(0);
  });
});

describe('User Management & Last Admin Protection', () => {
  it('should reject deactivating the last active Admin', async () => {
    const admin = await query(`SELECT id FROM users WHERE username = 'admin'`);
    const adminId = admin.rows[0].id;

    const res = await request(app)
      .patch(`/api/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('last active Administrator');
  });

  it('should reject demoting the last active Admin', async () => {
    const admin = await query(`SELECT id FROM users WHERE username = 'admin'`);
    const adminId = admin.rows[0].id;

    const res = await request(app)
      .put(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('last active Administrator');
  });
});

describe('Reports & CSV Generation', () => {
  it('should generate JSON stock report', async () => {
    const res = await request(app)
      .get('/api/reports?type=stock&format=json')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('json');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should generate CSV movements report with text/csv header', async () => {
    const res = await request(app)
      .get('/api/reports?type=movements&format=csv')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('"SKU","Product Name"');
  });
});
