# StockSphere - Smart Inventory & Warehouse Management System

StockSphere is a complete, production-quality, enterprise-grade inventory and warehouse management system designed to deliver real-time multi-warehouse inventory tracking, transactional stock movements, an append-only ledger, and role-based operational security.

---

## 🚀 Quick Start

### Option A: Local Development (Fastest, Zero External Dependencies)

StockSphere comes with an embedded PostgreSQL engine (PGlite WebAssembly) out of the box when `DATABASE_URL` is omitted, as well as automatic PostgreSQL connection pooling if `DATABASE_URL` is set.

1. **Install Dependencies**:
   ```bash
   # In server/
   npm --prefix server install

   # In client/
   npm --prefix client install
   ```

2. **Configure Environment**:
   - `server/.env` is pre-configured with safe defaults.
   - `client/.env` connects to `http://localhost:5000/api`.

3. **Seed Database**:
   ```bash
   npm --prefix server run seed
   ```

4. **Start Application**:
   - Terminal 1 (Backend API):
     ```bash
     npm --prefix server run dev
     ```
   - Terminal 2 (Frontend Client):
     ```bash
     npm --prefix client run dev
     ```
   - Visit: `http://localhost:5173`

### Option B: Docker Compose

```bash
docker compose up -d
docker compose exec server npm run seed
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`

---

## 👥 Demo Logins

| Role | Username / Email | Password | Assigned Warehouses |
|---|---|---|---|
| **Admin** | `admin` / `admin@stocksphere.com` | `Admin@StockSphere2026!` | Global / All Warehouses |
| **Manager** | `manager` / `manager@stocksphere.com` | `Manager@StockSphere2026!` | Global / All Warehouses |
| **Staff 1** | `staff1` / `staff1@stocksphere.com` | `Staff@StockSphere2026!` | WH-MDC, WH-WCH |
| **Staff 2** | `staff2` / `staff2@stocksphere.com` | `Staff@StockSphere2026!` | WH-ECD |

*(Quick-fill buttons are also available directly on the login page for instant one-click testing.)*

---

## 🏛 Architecture & Layering Rules

StockSphere strictly enforces architectural layering:
```
HTTP Request
     │
     ▼
routes/               (Express router definition & route-level middleware)
     │
     ▼
controllers/          (HTTP handling, status codes, query parsing, cookie handling ONLY)
     │
     ▼
services/             (Business logic, domain calculations, ACID transactions)
     │
     ▼
repositories/         (Parameterized SQL queries, zero business logic)
     │
     ▼
PostgreSQL Database   (Constraints, composite keys, immutable trigger, indexes)
```

---

## 🔐 Roles & Permissions Matrix

| Capability / Resource | Admin | Manager | Staff |
|---|:---:|:---:|:---:|
| User Management (Create/Edit/Status) | ✅ | ❌ | ❌ |
| Warehouse Management (Create/Edit) | ✅ | ❌ | ❌ |
| Category & Supplier Management | ✅ | ✅ | ❌ |
| Product Catalog Management | ✅ | ✅ | ❌ |
| Stock In Operations | ✅ | ✅ | ✅ (Assigned WH only) |
| Stock Out Operations | ✅ | ✅ | ✅ (Assigned WH only) |
| Stock Transfers | ✅ | ✅ | ❌ |
| Stock Adjustments | ✅ | ✅ | ❌ |
| View Inventory & Movements | ✅ | ✅ | ✅ (Assigned WH only) |
| Executive & Financial Reports | ✅ | ✅ | ❌ |
| Export Reports to CSV | ✅ | ✅ | ❌ |

---

## 📦 Stock Operation Invariants & Rules

1. **Stock In**:
   - Atomic upsert: `INSERT ... ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = stock_balances.quantity + $qty RETURNING quantity`.
   - Records positive signed movement (`type='IN'`) with unit cost snapshot.
2. **Stock Out**:
   - Atomic decrement: `UPDATE stock_balances SET quantity = quantity - $qty WHERE product_id=$1 AND warehouse_id=$2 AND quantity >= $qty RETURNING quantity`.
   - Rejection: Zero rows updated triggers a `409 Conflict` with exact available units.
   - Records negative signed movement (`type='OUT'`).
3. **Stock Transfer**:
   - Deadlock-free locking: Balance rows for source and destination warehouses are locked using `SELECT ... FOR UPDATE` in ascending UUID order.
   - Atomic decrement of source and increment of destination.
   - Writes two linked ledger entries sharing a single `transfer_id`. Full rollback on failure.
4. **Stock Adjustment**:
   - The server recomputes the signed difference ($\Delta = \text{counted} - \text{current}$) inside the transaction (client numbers are never trusted).
   - Mandatory reason required by audit policy.
   - Ledger adjustments are permanent; client has an unsubmitted LIFO undo stack.
5. **Append-Only Ledger**:
   - Database trigger `trg_prevent_movement_mutation` raises an exception on any `UPDATE` or `DELETE` statement targeting `inventory_movements`.
   - Ledger invariant verified continuously: $\sum \text{quantity\_change} \equiv \text{stock\_balances.quantity}$.
6. **Idempotency**:
   - Write endpoints accept `Idempotency-Key` header; cached responses prevent duplicate transactions.

---

## 📐 Assumptions & Metric Definitions (Rule 5)

1. **Quantities & Currencies**: Quantities are stored as signed/unsigned integers (`INT`). Monetary fields (`cost_price`, `selling_price`, `unit_cost`) are stored with strict precision as `NUMERIC(12,2)`.
2. **Stock Metric Formulas**:
   - `total stock` = $\sum$ quantities across all active warehouses.
   - `inventory value` = $\text{cost\_price} \times \text{available quantity}$.
   - `low stock` = $\text{total quantity} \le \text{reorder\_level}$.
   - `out of stock` = $\text{total quantity} = 0$.
   - `suggested replenishment` = $\max(\text{reorder\_level} \times 2 - \text{current}, 0)$.
3. **Staff Scoping**: Staff members are scoped via `user_warehouses`. Write operations outside assigned warehouses return `403 Forbidden`. Admin and Manager roles possess global warehouse access.
4. **Session Management**: JWT access tokens are stored in `httpOnly`, `SameSite=Lax` cookies, paired with database-backed refresh tokens in the `refresh_tokens` table.

---

## 🧪 Testing Instructions

StockSphere includes automated integration tests executed against a real database instance:

```bash
npm --prefix server test
```

### Verified Test Cases:
- **Authentication & Roles**: 401 on unauthenticated requests; 403 on role privilege violations.
- **SKU Constraints**: Enforcing SKU uniqueness and soft-archiving with movement history preservation.
- **Stock In & Stock Out**: Receiving, dispatching, and verifying 409 insufficient stock rejections.
- **Staff Scoping**: Forbidding stock actions outside assigned facilities.
- **Two-Phase Transfer**: Atomic inter-warehouse movement, deadlock-free row locking, and rollback on insufficient source stock.
- **Concurrency**: 50 simultaneous parallel stock-outs asserting non-negative balances and exact ledger sum equality.
- **Physical Adjustment**: Server-side difference reconciliation.
- **Idempotency**: Deduplication via `Idempotency-Key` header.
- **Immutability Trigger**: Verification that `UPDATE` and `DELETE` on the movements ledger are rejected.
- **Last Admin Protection**: Forbidding deactivation or demotion of the final active admin.
- **Reports**: Validating calculation accuracy and CSV export streaming.

---

## 📚 Technical Data Structures

Detailed algorithms and PostgreSQL database structures are documented in [`docs/DATA_STRUCTURES.md`](file:///c:/Users/HP/Desktop/Datastructure/docs/DATA_STRUCTURES.md):
- **Trie** (`server/src/utils/trie.js`) for product autocomplete.
- **Min-Heap** (`server/src/utils/minHeap.js`) for low-stock urgency priority queue.
- **Stack** (`client/src/pages/StockAdjustment.jsx`) for client-side unsubmitted adjustment undo.
- **Tree** (`server/src/utils/treeUtils.js`) for recursive category/location hierarchies.
- **Hash Map** (`server/src/utils/skuCache.js`) for in-memory SKU lookup caching.
- **PostgreSQL B-Trees, Composite Keys, & Trigger** for ledger immutability and data integrity.
