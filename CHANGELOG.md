# StockSphere Changelog

All notable changes to the StockSphere project are documented in this file.

## [Phase 4: Production Hardening, Testing & Documentation] - 2026-10-29
### Added
- Comprehensive integration test suites (`server/tests/phase1.test.js` and `server/tests/phase2_3_4.test.js`) with 23 passing tests verifying:
  - Auth, role permission enforcement (401/403).
  - Duplicate SKU rejection & soft-archiving with movement history preservation.
  - Inbound receipts (Stock In) and outbound dispatches (Stock Out) with insufficient stock rejection (409).
  - Deadlock-free two-phase stock transfer locking and rollback on failure.
  - Concurrency stress testing: 50 parallel stock-out operations verifying balance never drops below zero and ledger invariant holds.
  - Physical stock adjustment calculation with server-side difference computation.
  - Idempotency key deduplication.
  - Append-only ledger immutability trigger preventing UPDATE and DELETE.
  - User management safety: prohibiting deactivation or demotion of the last active Administrator.
  - Report calculations and RFC 4180 compliant CSV export streaming.
- Full UI/UX polish across desktop, tablet, and mobile views:
  - Collapsible sidebar with role-aware navigation visibility.
  - Accessible dialog modals, confirmation alerts, toast notifications, loading skeletons, and empty states.
  - Keyboard-friendly product autocomplete with live stock previews.
- Production documentation:
  - `docs/DATA_STRUCTURES.md` detailing Trie, Min-Heap, Stack, Tree, Hash Map, B-Tree indexes, and Append-only ledger trigger.
  - `README.md` complete with setup guides (local & Docker Compose), architecture, permissions matrix, and demo credentials.

## [Phase 3: Suppliers, Reports & User Administration] - 2026-10-29
### Added
- Suppliers catalog (`/api/suppliers` & `/suppliers`) with vendor contact details, codes, and product associations.
- Operational & financial reports suite (`/api/reports` & `/reports`) generating JSON and CSV downloads for:
  - Inventory Valuation, Low-Stock Deficits, Warehouse Distributions, All Ledger Movements, Inbound Receipts, Outbound Dispatches, and Cycle Count Adjustments.
- User administration panel (`/api/users` & `/users`) for Administrators:
  - Account creation, role assignment (Admin, Manager, Staff), password resets, and warehouse scoping for Staff.
  - System protection logic preventing deactivation or demotion of the last active administrator.
- User profile & password update features (`/settings` & `/api/auth/change-password`).

## [Phase 2: Transfers, Adjustments & Algorithmic Structures] - 2026-10-29
### Added
- Deadlock-free two-phase stock transfers (`/api/inventory/transfer` & `/stock-transfer`) locking warehouse balances in ascending UUID order with shared `transfer_id`.
- Stock adjustment workflow (`/api/inventory/adjustment` & `/stock-adjustment`) computing signed differences server-side with mandatory audit reasons.
- Client-side LIFO Undo Stack for unsubmitted physical count form modifications.
- Trie prefix tree for product autocomplete suggestions.
- Binary Min-Heap priority queue ordering critical low-stock products by urgency severity ratio.
- In-memory Hash Map SKU lookup cache with TTL and invalidation hooks.
- Product Details view (`/products/:id`) showing per-warehouse balances and complete movement ledger histories.
- Idempotency middleware caching responses for non-GET endpoints via `Idempotency-Key` header.

## [Phase 1: MVP Initial Architecture] - 2026-10-29
### Added
- Multi-engine PostgreSQL configuration supporting standard `pg.Pool` with connection pooling and embedded PGlite for resilient zero-dependency testing and development.
- Initial PostgreSQL migration `001_initial_schema.sql` covering:
  - `users`, `user_warehouses`, `refresh_tokens`
  - `categories` (parent_id hierarchy), `suppliers`, `warehouses`
  - `products` (SKU uniqueness, reorder levels, soft archiving)
  - `stock_balances` (composite primary key, non-negative constraint)
  - `inventory_movements` (append-only ledger with trigger enforcing immutability)
  - `audit_log`, `idempotency_keys`
  - B-tree and partial indexes.
- Idempotent and safe database seed script (`server/src/scripts/seed.js`) generating demo users (admin, manager, staff1, staff2), 3 warehouses, 5 categories, 3 suppliers, and 10 products with balanced ledger movements and low-stock test cases.
- Docker Compose configuration (`docker-compose.yml`) orchestrated with PostgreSQL 16 container, Node.js backend, and React/Vite frontend.
