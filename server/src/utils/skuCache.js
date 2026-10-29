/**
 * In-memory Hash Map cache for product SKU lookups.
 * Provides O(1) average lookup and invalidation.
 */
class SkuCache {
  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.map = new Map();
    this.defaultTtl = defaultTtlMs;
  }

  set(sku, product, ttlMs = this.defaultTtl) {
    if (!sku) return;
    const key = sku.trim().toUpperCase();
    const expiresAt = Date.now() + ttlMs;
    this.map.set(key, { data: product, expiresAt });
  }

  get(sku) {
    if (!sku) return null;
    const key = sku.trim().toUpperCase();
    const entry = this.map.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.data;
  }

  has(sku) {
    return this.get(sku) !== null;
  }

  delete(sku) {
    if (!sku) return;
    this.map.delete(sku.trim().toUpperCase());
  }

  clear() {
    this.map.clear();
  }

  size() {
    return this.map.size;
  }
}

export const skuLookupCache = new SkuCache();
