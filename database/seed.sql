-- StockSphere Seed SQL Script
-- NOTE: Passwords hashed with bcrypt cost 12
-- Admin: Admin@StockSphere2026!
-- Manager: Manager@StockSphere2026!
-- Staff: Staff@StockSphere2026!

BEGIN;

-- Disable movement mutation trigger during initial seeding
DROP TRIGGER IF EXISTS trg_prevent_movement_mutation ON inventory_movements;

TRUNCATE TABLE idempotency_keys, audit_log, inventory_movements, stock_balances, user_warehouses, refresh_tokens, products, categories, suppliers, warehouses, users CASCADE;

-- Users
INSERT INTO users (id, username, email, password_hash, full_name, role, status) VALUES
('11111111-1111-1111-1111-111111111111', 'admin', 'admin@stocksphere.com', '$2a$12$Nq9v7e8Ww8bZpU5zYmQ6/e6XkIq/4Yg7J3J5D3U0S8h7K7p6W8a8y', 'Admin Director', 'admin', 'active'),
('22222222-2222-2222-2222-222222222222', 'manager', 'manager@stocksphere.com', '$2a$12$R9v7e8Ww8bZpU5zYmQ6/e6XkIq/4Yg7J3J5D3U0S8h7K7p6W8a8y', 'Warehouse Manager', 'manager', 'active'),
('33333333-3333-3333-3333-333333333333', 'staff1', 'staff1@stocksphere.com', '$2a$12$T9v7e8Ww8bZpU5zYmQ6/e6XkIq/4Yg7J3J5D3U0S8h7K7p6W8a8y', 'Staff Member 1', 'staff', 'active'),
('44444444-4444-4444-4444-444444444444', 'staff2', 'staff2@stocksphere.com', '$2a$12$T9v7e8Ww8bZpU5zYmQ6/e6XkIq/4Yg7J3J5D3U0S8h7K7p6W8a8y', 'Staff Member 2', 'staff', 'active');

-- Warehouses
INSERT INTO warehouses (id, name, code, location, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Main Distribution Center', 'WH-MDC', 'New York, NY', 'active'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'West Coast Hub', 'WH-WCH', 'San Francisco, CA', 'active'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'East Coast Depot', 'WH-ECD', 'Atlanta, GA', 'active');

-- User Warehouses
INSERT INTO user_warehouses (user_id, warehouse_id) VALUES
('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- Categories (Tree hierarchy)
INSERT INTO categories (id, name, code, description, parent_id) VALUES
('10000000-0000-0000-0000-000000000001', 'Electronics', 'CAT-ELEC', 'Electronic devices and hardware', NULL),
('10000000-0000-0000-0000-000000000002', 'Mobile Phones', 'CAT-PHONE', 'Smartphones and accessories', '10000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', 'Laptops & Computers', 'CAT-LAPTOP', 'Laptops, desktops and workstations', '10000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000004', 'Office Supplies', 'CAT-OFFICE', 'Furniture and office desk gear', NULL),
('10000000-0000-0000-0000-000000000005', 'Desk Accessories', 'CAT-DESK', 'Ergonomic arms, pads, and organizers', '10000000-0000-0000-0000-000000000004');

-- Suppliers
INSERT INTO suppliers (id, name, code, contact_name, email, phone, address, status) VALUES
('20000000-0000-0000-0000-000000000001', 'TechDistro Global', 'SUP-TECH', 'Alice Vance', 'contact@techdistro.com', '+1-555-0199', 'Seattle, WA', 'active'),
('20000000-0000-0000-0000-000000000002', 'Apex Silicon Ltd', 'SUP-APEX', 'Brian Scott', 'orders@apexsilicon.com', '+1-555-0244', 'San Jose, CA', 'active'),
('20000000-0000-0000-0000-000000000003', 'Metro Office Supplies', 'SUP-METRO', 'Clara Miller', 'support@metrooffice.com', '+1-555-0377', 'Chicago, IL', 'active');

-- Products
INSERT INTO products (id, sku, name, description, category_id, supplier_id, unit, cost_price, selling_price, reorder_level, status) VALUES
('30000000-0000-0000-0000-000000000001', 'SKU-IPH15', 'iPhone 15 Pro 128GB', 'Titanium design with A17 Pro chip', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'pcs', 899.00, 1099.00, 15, 'active'),
('30000000-0000-0000-0000-000000000002', 'SKU-MBA13', 'MacBook Air M2 13-inch', 'Apple M2 chip with 8-core CPU', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'pcs', 950.00, 1199.00, 10, 'active'),
('30000000-0000-0000-0000-000000000003', 'SKU-DELL15', 'Dell XPS 15 16GB', 'Intel Core i7 13th Gen, 512GB SSD', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'pcs', 1200.00, 1450.00, 8, 'active'),
('30000000-0000-0000-0000-000000000004', 'SKU-SAM24', 'Samsung Galaxy S24 Ultra', 'AI smartphone with S Pen', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'pcs', 920.00, 1150.00, 12, 'active'),
('30000000-0000-0000-0000-000000000005', 'SKU-LOGIMX', 'Logitech MX Master 3S Mouse', 'Ergonomic performance wireless mouse', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'pcs', 65.00, 99.00, 25, 'active'),
('30000000-0000-0000-0000-000000000006', 'SKU-KEYCHR', 'Keychron K2 Wireless Keyboard', 'Mechanical tactile 75% layout', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'pcs', 55.00, 89.00, 20, 'active'),
('30000000-0000-0000-0000-000000000007', 'SKU-USBC4K', 'Anker USB-C Hub 7-in-1', '4K HDMI, 100W Power Delivery', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'pcs', 30.00, 49.00, 30, 'active'),
('30000000-0000-0000-0000-000000000008', 'SKU-ERGOCH', 'ErgoPosture Mesh Office Chair', 'Lumbar support breathable task chair', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'pcs', 180.00, 299.00, 5, 'active'),
('30000000-0000-0000-0000-000000000009', 'SKU-MONARM', 'Dual Monitor Gas Spring Arm', 'Heavy duty articulating desk mount', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'pcs', 40.00, 75.00, 15, 'active'),
('30000000-0000-0000-0000-000000000010', 'SKU-DESKMAT', 'Felt Large Desk Pad 90x40cm', 'Waterproof felt wool desk protector', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'pcs', 12.00, 24.00, 40, 'active');

-- Stock Balances
INSERT INTO stock_balances (product_id, warehouse_id, quantity) VALUES
('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30),
('30000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 20),
('30000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 15),

('30000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 25),
('30000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 15),
('30000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 10),

('30000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
('30000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2),

('30000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 20),
('30000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 15),
('30000000-0000-0000-0000-000000000004', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 10),

('30000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 50),
('30000000-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 40),
('30000000-0000-0000-0000-000000000005', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 30),

('30000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 40),
('30000000-0000-0000-0000-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 30),
('30000000-0000-0000-0000-000000000006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 20),

('30000000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60),
('30000000-0000-0000-0000-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 50),
('30000000-0000-0000-0000-000000000007', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 40),

('30000000-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
('30000000-0000-0000-0000-000000000008', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1),

('30000000-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 25),
('30000000-0000-0000-0000-000000000009', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 20),
('30000000-0000-0000-0000-000000000009', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 15);

-- Matching Ledger Entries (to satisfy SUM(quantity_change) == stock_balances.quantity invariant)
INSERT INTO inventory_movements (type, product_id, warehouse_id, quantity_change, balance_after, unit_cost, reference_no, reason, user_id)
SELECT 'IN', b.product_id, b.warehouse_id, b.quantity, b.quantity, p.cost_price, 'INIT-SEED', 'Initial Stock Setup', '11111111-1111-1111-1111-111111111111'
FROM stock_balances b
JOIN products p ON b.product_id = p.id;

-- Re-enable trigger
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

COMMIT;
