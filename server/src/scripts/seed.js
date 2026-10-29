import bcrypt from 'bcryptjs';
import { query, exec, getDb, closeDb } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

export async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SAFETY CHECK: Seed script cannot be run in production environment (NODE_ENV=production).');
  }

  console.log('[SEED] Starting database seed process...');
  await getDb();

  // 1. Reset tables in dependency order
  // Note: We need to temporarily disable or drop the trigger to clean inventory_movements on reset
  await exec('DROP TRIGGER IF EXISTS trg_prevent_movement_mutation ON inventory_movements;');
  await exec('TRUNCATE TABLE idempotency_keys, audit_log, inventory_movements, stock_balances, user_warehouses, refresh_tokens, products, categories, suppliers, warehouses, users CASCADE;');

  // Re-enable trigger
  await exec(`
    CREATE OR REPLACE FUNCTION prevent_movement_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'Inventory movements are immutable append-only ledger entries. UPDATE and DELETE operations are forbidden.';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_prevent_movement_mutation ON inventory_movements;
    CREATE TRIGGER trg_prevent_movement_mutation
    BEFORE UPDATE OR DELETE ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_movement_mutation();
  `);

  console.log('[SEED] Cleaned database tables.');

  // 2. Insert Users
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@StockSphere2026!';
  const managerPassword = process.env.MANAGER_INITIAL_PASSWORD || 'Manager@StockSphere2026!';
  const staffPassword = process.env.STAFF_INITIAL_PASSWORD || 'Staff@StockSphere2026!';

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const managerHash = await bcrypt.hash(managerPassword, 12);
  const staffHash = await bcrypt.hash(staffPassword, 12);

  const adminRes = await query(`
    INSERT INTO users (username, email, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
  `, ['admin', 'admin@stocksphere.com', adminHash, 'Admin Director', 'admin', 'active']);
  const adminId = adminRes.rows[0].id;

  const managerRes = await query(`
    INSERT INTO users (username, email, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
  `, ['manager', 'manager@stocksphere.com', managerHash, 'Warehouse Manager', 'manager', 'active']);
  const managerId = managerRes.rows[0].id;

  const staff1Res = await query(`
    INSERT INTO users (username, email, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
  `, ['staff1', 'staff1@stocksphere.com', staffHash, 'Staff Member 1', 'staff', 'active']);
  const staff1Id = staff1Res.rows[0].id;

  const staff2Res = await query(`
    INSERT INTO users (username, email, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
  `, ['staff2', 'staff2@stocksphere.com', staffHash, 'Staff Member 2', 'staff', 'active']);
  const staff2Id = staff2Res.rows[0].id;

  console.log('[SEED] Users created: admin, manager, staff1, staff2');

  // 3. Insert Warehouses
  const mdcRes = await query(`
    INSERT INTO warehouses (name, code, location, status)
    VALUES ('Main Distribution Center', 'WH-MDC', 'New York, NY', 'active') RETURNING id
  `);
  const mdcId = mdcRes.rows[0].id;

  const wchRes = await query(`
    INSERT INTO warehouses (name, code, location, status)
    VALUES ('West Coast Hub', 'WH-WCH', 'San Francisco, CA', 'active') RETURNING id
  `);
  const wchId = wchRes.rows[0].id;

  const ecdRes = await query(`
    INSERT INTO warehouses (name, code, location, status)
    VALUES ('East Coast Depot', 'WH-ECD', 'Atlanta, GA', 'active') RETURNING id
  `);
  const ecdId = ecdRes.rows[0].id;

  console.log('[SEED] 3 Warehouses created.');

  // 4. Assign Warehouses to Staff
  await query('INSERT INTO user_warehouses (user_id, warehouse_id) VALUES ($1, $2), ($1, $3)', [staff1Id, mdcId, wchId]);
  await query('INSERT INTO user_warehouses (user_id, warehouse_id) VALUES ($1, $2)', [staff2Id, ecdId]);
  console.log('[SEED] Staff warehouse assignments set.');

  // 5. Insert Categories (Hierarchical Tree)
  const catElecRes = await query(`
    INSERT INTO categories (name, code, description, parent_id)
    VALUES ('Electronics', 'CAT-ELEC', 'Electronic devices and hardware', NULL) RETURNING id
  `);
  const catElecId = catElecRes.rows[0].id;

  const catPhonesRes = await query(`
    INSERT INTO categories (name, code, description, parent_id)
    VALUES ('Mobile Phones', 'CAT-PHONE', 'Smartphones and accessories', $1) RETURNING id
  `, [catElecId]);
  const catPhonesId = catPhonesRes.rows[0].id;

  const catLaptopsRes = await query(`
    INSERT INTO categories (name, code, description, parent_id)
    VALUES ('Laptops & Computers', 'CAT-LAPTOP', 'Laptops, desktops and workstations', $1) RETURNING id
  `, [catElecId]);
  const catLaptopsId = catLaptopsRes.rows[0].id;

  const catOfficeRes = await query(`
    INSERT INTO categories (name, code, description, parent_id)
    VALUES ('Office Supplies', 'CAT-OFFICE', 'Furniture and office desk gear', NULL) RETURNING id
  `);
  const catOfficeId = catOfficeRes.rows[0].id;

  const catDeskRes = await query(`
    INSERT INTO categories (name, code, description, parent_id)
    VALUES ('Desk Accessories', 'CAT-DESK', 'Ergonomic arms, pads, and organizers', $1) RETURNING id
  `, [catOfficeId]);
  const catDeskId = catDeskRes.rows[0].id;

  console.log('[SEED] 5 Categories created in tree hierarchy.');

  // 6. Insert Suppliers
  const sup1Res = await query(`
    INSERT INTO suppliers (name, code, contact_name, email, phone, address, status)
    VALUES ('TechDistro Global', 'SUP-TECH', 'Alice Vance', 'contact@techdistro.com', '+1-555-0199', 'Seattle, WA', 'active') RETURNING id
  `);
  const sup1Id = sup1Res.rows[0].id;

  const sup2Res = await query(`
    INSERT INTO suppliers (name, code, contact_name, email, phone, address, status)
    VALUES ('Apex Silicon Ltd', 'SUP-APEX', 'Brian Scott', 'orders@apexsilicon.com', '+1-555-0244', 'San Jose, CA', 'active') RETURNING id
  `);
  const sup2Id = sup2Res.rows[0].id;

  const sup3Res = await query(`
    INSERT INTO suppliers (name, code, contact_name, email, phone, address, status)
    VALUES ('Metro Office Supplies', 'SUP-METRO', 'Clara Miller', 'support@metrooffice.com', '+1-555-0377', 'Chicago, IL', 'active') RETURNING id
  `);
  const sup3Id = sup3Res.rows[0].id;

  console.log('[SEED] 3 Suppliers created.');

  // 7. Insert 10 Products
  const productsData = [
    { sku: 'SKU-IPH15', name: 'iPhone 15 Pro 128GB', desc: 'Titanium design with A17 Pro chip', catId: catPhonesId, supId: sup1Id, unit: 'pcs', cost: 899.00, price: 1099.00, reorder: 15 },
    { sku: 'SKU-MBA13', name: 'MacBook Air M2 13-inch', desc: 'Apple M2 chip with 8-core CPU', catId: catLaptopsId, supId: sup1Id, unit: 'pcs', cost: 950.00, price: 1199.00, reorder: 10 },
    { sku: 'SKU-DELL15', name: 'Dell XPS 15 16GB', desc: 'Intel Core i7 13th Gen, 512GB SSD', catId: catLaptopsId, supId: sup2Id, unit: 'pcs', cost: 1200.00, price: 1450.00, reorder: 8 }, // Will be low stock (4 total)
    { sku: 'SKU-SAM24', name: 'Samsung Galaxy S24 Ultra', desc: 'AI smartphone with S Pen', catId: catPhonesId, supId: sup2Id, unit: 'pcs', cost: 920.00, price: 1150.00, reorder: 12 },
    { sku: 'SKU-LOGIMX', name: 'Logitech MX Master 3S Mouse', desc: 'Ergonomic performance wireless mouse', catId: catDeskId, supId: sup3Id, unit: 'pcs', cost: 65.00, price: 99.00, reorder: 25 },
    { sku: 'SKU-KEYCHR', name: 'Keychron K2 Wireless Keyboard', desc: 'Mechanical tactile 75% layout', catId: catDeskId, supId: sup3Id, unit: 'pcs', cost: 55.00, price: 89.00, reorder: 20 },
    { sku: 'SKU-USBC4K', name: 'Anker USB-C Hub 7-in-1', desc: '4K HDMI, 100W Power Delivery', catId: catElecId, supId: sup2Id, unit: 'pcs', cost: 30.00, price: 49.00, reorder: 30 },
    { sku: 'SKU-ERGOCH', name: 'ErgoPosture Mesh Office Chair', desc: 'Lumbar support breathable task chair', catId: catOfficeId, supId: sup3Id, unit: 'pcs', cost: 180.00, price: 299.00, reorder: 5 }, // Will be low stock (3 total)
    { sku: 'SKU-MONARM', name: 'Dual Monitor Gas Spring Arm', desc: 'Heavy duty articulating desk mount', catId: catDeskId, supId: sup3Id, unit: 'pcs', cost: 40.00, price: 75.00, reorder: 15 },
    { sku: 'SKU-DESKMAT', name: 'Felt Large Desk Pad 90x40cm', desc: 'Waterproof felt wool desk protector', catId: catDeskId, supId: sup3Id, unit: 'pcs', cost: 12.00, price: 24.00, reorder: 40 } // Out of stock (0)
  ];

  const productMap = {};
  for (const p of productsData) {
    const res = await query(`
      INSERT INTO products (sku, name, description, category_id, supplier_id, unit, cost_price, selling_price, reorder_level, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active') RETURNING id, sku, cost_price
    `, [p.sku, p.name, p.desc, p.catId, p.supId, p.unit, p.cost, p.price, p.reorder]);
    productMap[p.sku] = res.rows[0];
  }
  console.log('[SEED] 10 Products created.');

  // 8. Initial Balances & Matching IN Ledger Entries
  // Quantities per warehouse:
  // SKU-IPH15: MDC=30, WCH=20, ECD=15 (Total 65, reorder 15 - Normal)
  // SKU-MBA13: MDC=25, WCH=15, ECD=10 (Total 50, reorder 10 - Normal)
  // SKU-DELL15: MDC=2, WCH=2, ECD=0 (Total 4, reorder 8 - LOW STOCK ALERT!)
  // SKU-SAM24: MDC=20, WCH=15, ECD=10 (Total 45, reorder 12 - Normal)
  // SKU-LOGIMX: MDC=50, WCH=40, ECD=30 (Total 120, reorder 25 - Normal)
  // SKU-KEYCHR: MDC=40, WCH=30, ECD=20 (Total 90, reorder 20 - Normal)
  // SKU-USBC4K: MDC=60, WCH=50, ECD=40 (Total 150, reorder 30 - Normal)
  // SKU-ERGOCH: MDC=2, WCH=1, ECD=0 (Total 3, reorder 5 - LOW STOCK ALERT!)
  // SKU-MONARM: MDC=25, WCH=20, ECD=15 (Total 60, reorder 15 - Normal)
  // SKU-DESKMAT: MDC=0, WCH=0, ECD=0 (Total 0, reorder 40 - OUT OF STOCK ALERT!)

  const initialStocks = [
    { sku: 'SKU-IPH15', wh: mdcId, qty: 30 },
    { sku: 'SKU-IPH15', wh: wchId, qty: 20 },
    { sku: 'SKU-IPH15', wh: ecdId, qty: 15 },

    { sku: 'SKU-MBA13', wh: mdcId, qty: 25 },
    { sku: 'SKU-MBA13', wh: wchId, qty: 15 },
    { sku: 'SKU-MBA13', wh: ecdId, qty: 10 },

    { sku: 'SKU-DELL15', wh: mdcId, qty: 2 },
    { sku: 'SKU-DELL15', wh: wchId, qty: 2 },

    { sku: 'SKU-SAM24', wh: mdcId, qty: 20 },
    { sku: 'SKU-SAM24', wh: wchId, qty: 15 },
    { sku: 'SKU-SAM24', wh: ecdId, qty: 10 },

    { sku: 'SKU-LOGIMX', wh: mdcId, qty: 50 },
    { sku: 'SKU-LOGIMX', wh: wchId, qty: 40 },
    { sku: 'SKU-LOGIMX', wh: ecdId, qty: 30 },

    { sku: 'SKU-KEYCHR', wh: mdcId, qty: 40 },
    { sku: 'SKU-KEYCHR', wh: wchId, qty: 30 },
    { sku: 'SKU-KEYCHR', wh: ecdId, qty: 20 },

    { sku: 'SKU-USBC4K', wh: mdcId, qty: 60 },
    { sku: 'SKU-USBC4K', wh: wchId, qty: 50 },
    { sku: 'SKU-USBC4K', wh: ecdId, qty: 40 },

    { sku: 'SKU-ERGOCH', wh: mdcId, qty: 2 },
    { sku: 'SKU-ERGOCH', wh: wchId, qty: 1 },

    { sku: 'SKU-MONARM', wh: mdcId, qty: 25 },
    { sku: 'SKU-MONARM', wh: wchId, qty: 20 },
    { sku: 'SKU-MONARM', wh: ecdId, qty: 15 },
  ];

  for (const item of initialStocks) {
    const prod = productMap[item.sku];
    // Insert balance row
    await query(`
      INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = $3
    `, [prod.id, item.wh, item.qty]);

    // Insert matching IN movement row to maintain the ledger invariant!
    await query(`
      INSERT INTO inventory_movements (type, product_id, warehouse_id, quantity_change, balance_after, unit_cost, reference_no, reason, user_id)
      VALUES ('IN', $1, $2, $3, $3, $4, 'INIT-SEED', 'Initial Stock Setup', $5)
    `, [prod.id, item.wh, item.qty, prod.cost_price, adminId]);
  }

  console.log('[SEED] Stock balances and matching ledger movements inserted.');

  // 9. Invariant Verification: SUM(quantity_change) == stock_balances.quantity
  const verifyRes = await query(`
    SELECT b.product_id, b.warehouse_id, b.quantity AS balance_qty,
           COALESCE(SUM(m.quantity_change), 0) AS ledger_sum
    FROM stock_balances b
    LEFT JOIN inventory_movements m ON b.product_id = m.product_id AND b.warehouse_id = m.warehouse_id
    GROUP BY b.product_id, b.warehouse_id, b.quantity
    HAVING b.quantity <> COALESCE(SUM(m.quantity_change), 0)
  `);

  if (verifyRes.rows.length > 0) {
    console.error('[SEED] Invariant check FAILED:', verifyRes.rows);
    throw new Error('LEDGER INVARIANT VIOLATION: Ledger sum does not match stock balance.');
  }

  console.log('[SEED] Invariant check PASSED: SUM(quantity_change) in ledger strictly matches stock_balances.quantity for all records.');
  console.log('[SEED] Demo seed completed successfully!');
  console.log('---------------------------------------------------------');
  console.log('StockSphere Demo Accounts:');
  console.log('Admin:   admin@stocksphere.com   / Password: ' + adminPassword);
  console.log('Manager: manager@stocksphere.com / Password: ' + managerPassword);
  console.log('Staff 1: staff1@stocksphere.com  / Password: ' + staffPassword + ' (Warehouses: WH-MDC, WH-WCH)');
  console.log('Staff 2: staff2@stocksphere.com  / Password: ' + staffPassword + ' (Warehouse: WH-ECD)');
  console.log('---------------------------------------------------------');
}

// If run directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SEED ERROR]', err);
      await closeDb();
      process.exit(1);
    });
}
