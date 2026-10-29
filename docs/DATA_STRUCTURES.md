# StockSphere Data Structures Architecture

This document provides a comprehensive technical breakdown of data structures used throughout the StockSphere system. It is organized into two clearly distinct sections: **Data Structures Implemented in Application Code** and **Data Structures Provided by PostgreSQL**.

---

## 1. Implemented in Application Code

### 1.1 Trie (Prefix Tree) for Product Autocomplete
- **Location**: `server/src/utils/trie.js` and `client/src/components/Autocomplete.jsx`
- **Purpose**: Provides real-time, low-latency autocomplete suggestions for warehouse operators searching across tens of thousands of SKUs and product names.
- **Implementation**:
  - Each `TrieNode` maintains an associative map of characters to child nodes, a boolean `isEndOfWord`, and an array of product payload references.
  - When typing in the search bar, the query traverses down the tree path corresponding to the prefix in $\mathcal{O}(L)$ time (where $L$ is query string length), completely independent of the catalog size $N$.
- **Complexity**:
  - Search: $\mathcal{O}(L)$
  - Insertion: $\mathcal{O}(L)$
  - Space: $\mathcal{O}(\sum \text{len}(\text{words}) \times |\Sigma|)$

### 1.2 Min-Heap for Low-Stock Urgency Priority Ordering
- **Location**: `server/src/utils/minHeap.js` and `server/src/services/dashboardService.js`
- **Purpose**: Dynamically surfaces the most critically depleted products at the top of executive dashboards and replenishment queues.
- **Implementation**:
  - A binary min-heap backed by an array `heap[]` using standard child index formulas ($2i+1, 2i+2$).
  - Comparator evaluates the **severity ratio**:
    $$\text{Severity Ratio} = \frac{\text{Current Stock Quantity}}{\text{Reorder Level}}$$
    Items with the lowest ratio (e.g., $0 / 40 = 0.0$ or $2 / 10 = 0.2$) float to the root via `_bubbleUp` and `_sinkDown`, ensuring the top-priority purchase orders are highlighted first.
- **Complexity**:
  - Peek Min: $\mathcal{O}(1)$
  - Push / Pop: $\mathcal{O}(\log K)$ where $K$ is the number of low-stock alerts.

### 1.3 Stack for Client-Side Unsubmitted Adjustment Edits (Undo Stack)
- **Location**: `client/src/pages/StockAdjustment.jsx`
- **Purpose**: Warehouse auditors performing cycle counts frequently make tentative adjustments or typing slips before saving. Completed adjustments in the database are permanent and immutable; this LIFO stack provides non-destructive client-side undo for unsubmitted edits.
- **Implementation**:
  - An array-backed LIFO stack `undoStack` managed by React state.
  - Every time the user updates the counted quantity, previous states `[{ countedQuantity, reason, notes }]` are pushed onto the stack.
  - Clicking "Undo Edit" pops the top snapshot $\mathcal{O}(1)$ and restores prior unsubmitted values without triggering network mutations.
- **Complexity**:
  - Push: $\mathcal{O}(1)$
  - Pop: $\mathcal{O}(1)$

### 1.4 Tree for Hierarchical Categories & Warehouse Zones
- **Location**: `server/src/utils/treeUtils.js` and `client/src/pages/Categories.jsx`
- **Purpose**: Models recursive organizational structures (e.g., Electronics $\rightarrow$ Laptops $\rightarrow$ Workstations).
- **Implementation**:
  - PostgreSQL self-referencing foreign key (`parent_id`) is transformed into an N-ary tree via a two-pass algorithm in `buildHierarchyTree(flatList)`.
  - Recursive Depth-First Traversal (`traverseTreeDFS`) computes indentation, nested breadcrumbs, and subtree product counts.
- **Complexity**:
  - Construction: $\mathcal{O}(N)$ where $N$ is the number of nodes.
  - Traversal: $\mathcal{O}(N)$.

### 1.5 Hash Map for In-Memory SKU Lookup Cache
- **Location**: `server/src/utils/skuCache.js`
- **Purpose**: Provides $\mathcal{O}(1)$ cached lookup for product validation during high-throughput barcoding and scanning workflows.
- **Implementation**:
  - Encapsulates JavaScript's native hash map `Map` with uppercase SKU normalization, TTL expiration, and cache invalidation hooks on product update/archive.
- **Complexity**:
  - Lookup: $\mathcal{O}(1)$ average.
  - Invalidation: $\mathcal{O}(1)$.

---

## 2. Provided by PostgreSQL

### 2.1 B-Tree Indexes
- **Indexes Created**:
  - `idx_products_sku`: B-Tree index on `products(sku)` for $\mathcal{O}(\log N)$ unique lookups.
  - `idx_products_name`: B-Tree index on `products(name)` for sorting and range queries.
  - `idx_stock_balances_product`: B-Tree index on `stock_balances(product_id)`.
  - `idx_stock_balances_warehouse`: B-Tree index on `stock_balances(warehouse_id)`.
  - `idx_movements_created_at_desc`: B-Tree index on `inventory_movements(created_at DESC)` for high-performance reverse-chronological ledger feeds.
  - `idx_movements_transfer`: Partial B-Tree index on `inventory_movements(transfer_id) WHERE transfer_id IS NOT NULL`.
  - `idx_idempotency_expires`: B-Tree index on `idempotency_keys(expires_at)` for cache TTL sweeps.
- **Characteristics**: Balanced search trees with high fan-out (order 100+), guaranteeing predictable logarithmic traversal and index range scans.

### 2.2 Unique & Composite Keys
- **`stock_balances(product_id, warehouse_id)`**:
  - Composite primary key enforcing that only one balance record exists per product-warehouse pair.
  - Supported by a check constraint `CHECK (quantity >= 0)` guaranteeing that inventory never drops below zero at the storage engine level.
- **`user_warehouses(user_id, warehouse_id)`**:
  - Composite primary key preventing duplicate facility assignments for staff.

### 2.3 Append-Only Ledger Enforced by Trigger
- **Table**: `inventory_movements`
- **Mechanism**:
  - Database function `prevent_movement_mutation()` attached to trigger `trg_prevent_movement_mutation` BEFORE UPDATE OR DELETE:
    ```sql
    CREATE OR REPLACE FUNCTION prevent_movement_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'Inventory movements are immutable append-only ledger entries. UPDATE and DELETE operations are forbidden.';
    END;
    $$ LANGUAGE plpgsql;
    ```
  - Guarantees data integrity and audit compliance: once written, movement records can never be mutated or erased. Erroneous adjustments are corrected exclusively via compensating entries (`reversal_of`).
  - Strict invariant maintained across all transactions:
    $$\sum \text{quantity\_change} \equiv \text{stock\_balances.quantity}$$

---

## 3. Future Work

- **Asynchronous Task Queue (Worker Queue)**:
  - For large-scale batch PDF/CSV report generation or ERP webhook webhooks, an asynchronous Redis-backed queue (e.g. BullMQ) or PostgreSQL `pg_notify` / `LISTEN` queue can be integrated. Currently, reporting operates synchronously via streamed CSV generation.
