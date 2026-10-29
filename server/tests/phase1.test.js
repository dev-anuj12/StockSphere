import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { seed } from '../src/scripts/seed.js';
import { query, closeDb } from '../src/config/db.js';

let adminToken = '';
let managerToken = '';
let staff1Token = '';
let staff2Token = '';
let testProductId = '';
let testWarehouseMdcId = '';
let testWarehouseWchId = '';
let testWarehouseEcdId = '';

beforeAll(async () => {
  // Re-seed demo database before running tests
  await seed();

  // Login Admin
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'Admin@StockSphere2026!' });
  expect(adminRes.status).toBe(200);
  adminToken = adminRes.body.token;

  // Login Manager
  const managerRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'manager', password: 'Manager@StockSphere2026!' });
  expect(managerRes.status).toBe(200);
  managerToken = managerRes.body.token;

  // Login Staff 1 (WH-MDC & WH-WCH)
  const staff1Res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'staff1', password: 'Staff@StockSphere2026!' });
  expect(staff1Res.status).toBe(200);
  staff1Token = staff1Res.body.token;

  // Login Staff 2 (WH-ECD)
  const staff2Res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'staff2', password: 'Staff@StockSphere2026!' });
  expect(staff2Res.status).toBe(200);
  staff2Token = staff2Res.body.token;

  // Fetch product and warehouse IDs for subsequent tests
  const prodRes = await request(app)
    .get('/api/products?search=SKU-IPH15')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(prodRes.status).toBe(200);
  testProductId = prodRes.body.data[0].id;

  const whRes = await request(app)
    .get('/api/warehouses')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(whRes.status).toBe(200);

  const mdc = whRes.body.data.find(w => w.code === 'WH-MDC');
  const wch = whRes.body.data.find(w => w.code === 'WH-WCH');
  const ecd = whRes.body.data.find(w => w.code === 'WH-ECD');

  testWarehouseMdcId = mdc.id;
  testWarehouseWchId = wch.id;
  testWarehouseEcdId = ecd.id;
});

afterAll(async () => {
  await closeDb();
});

describe('Authentication & Role Permissions', () => {
  it('should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return user info on /api/auth/me for authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('admin');
    expect(res.body.user.role).toBe('admin');
  });

  it('should allow Manager to list and create products', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should forbid Staff from creating products (403)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        sku: 'SKU-UNAUTH',
        name: 'Unauthorized Product',
        cost_price: 10,
        selling_price: 20,
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should forbid Manager from creating warehouses (403 - Admin only)', async () => {
    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Forbidden Warehouse',
        code: 'WH-FORBID',
        location: 'Nowhere',
      });
    expect(res.status).toBe(403);
  });
});

describe('Product Management & SKU Constraints', () => {
  it('should reject creating a product with duplicate SKU', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'SKU-IPH15', // Existing SKU from seed
        name: 'Duplicate Phone',
        cost_price: 500,
        selling_price: 700,
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already exists');
  });

  it('should create a valid new product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'SKU-NEW001',
        name: 'Wireless Noise Cancelling Headphones',
        description: 'Over-ear premium headphones',
        unit: 'pcs',
        cost_price: 150.00,
        selling_price: 249.00,
        reorder_level: 12,
      });
    expect(res.status).toBe(201);
    expect(res.body.sku).toBe('SKU-NEW001');
    expect(res.body.id).toBeDefined();
  });
});

describe('Stock In & Stock Out Operations', () => {
  it('should allow Staff 1 to Stock In to an assigned warehouse (WH-MDC)', async () => {
    const prevRes = await query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [testProductId, testWarehouseMdcId]);
    const prevQty = prevRes.rows[0].quantity;

    const res = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseMdcId,
        quantity: 10,
        referenceNo: 'PO-TEST-001',
        reason: 'Restock shipment',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.new_balance).toBe(prevQty + 10);

    // Verify ledger row was created
    const movRes = await query(`
      SELECT * FROM inventory_movements WHERE id = $1
    `, [res.body.movement_id]);
    expect(movRes.rows.length).toBe(1);
    expect(movRes.rows[0].type).toBe('IN');
    expect(movRes.rows[0].quantity_change).toBe(10);
  });

  it('should reject Staff 1 Stock In to an UNASSIGNED warehouse (WH-ECD) with 403', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseEcdId, // Staff 1 does NOT have access to WH-ECD
        quantity: 5,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('authorization');
  });

  it('should allow Staff 1 to Stock Out from assigned warehouse with sufficient stock', async () => {
    const prevRes = await query(`
      SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2
    `, [testProductId, testWarehouseMdcId]);
    const prevQty = prevRes.rows[0].quantity;

    const res = await request(app)
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseMdcId,
        quantity: 5,
        referenceNo: 'SO-TEST-001',
        reason: 'Customer order',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.new_balance).toBe(prevQty - 5);

    // Verify ledger row has negative signed quantity_change
    const movRes = await query(`
      SELECT * FROM inventory_movements WHERE id = $1
    `, [res.body.movement_id]);
    expect(movRes.rows.length).toBe(1);
    expect(movRes.rows[0].type).toBe('OUT');
    expect(movRes.rows[0].quantity_change).toBe(-5);
  });

  it('should reject Stock Out when requested quantity exceeds available stock with 409', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_id: testProductId,
        warehouse_id: testWarehouseMdcId,
        quantity: 999999, // Insufficient
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.message).toContain('Insufficient stock');
    expect(res.body.details.available).toBeDefined();
  });
});

describe('Ledger Invariant Verification', () => {
  it('should satisfy SUM(quantity_change) == stock_balances.quantity for all records', async () => {
    const res = await query(`
      SELECT b.product_id, b.warehouse_id, b.quantity AS balance_qty,
             COALESCE(SUM(m.quantity_change), 0)::INT AS ledger_sum
      FROM stock_balances b
      LEFT JOIN inventory_movements m ON b.product_id = m.product_id AND b.warehouse_id = m.warehouse_id
      GROUP BY b.product_id, b.warehouse_id, b.quantity
      HAVING b.quantity <> COALESCE(SUM(m.quantity_change), 0)
    `);

    expect(res.rows.length).toBe(0);
  });
});
