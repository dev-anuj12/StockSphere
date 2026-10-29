import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU must be at least 2 characters').max(100),
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  supplier_id: z.string().uuid('Invalid supplier ID').optional().nullable(),
  unit: z.string().min(1).default('pcs'),
  cost_price: z.number().min(0, 'Cost price must be non-negative'),
  selling_price: z.number().min(0, 'Selling price must be non-negative'),
  reorder_level: z.number().int().min(0, 'Reorder level must be non-negative').default(10),
});

export const updateProductSchema = createProductSchema.partial();
