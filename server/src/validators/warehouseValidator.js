import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name: z.string().min(2, 'Warehouse name must be at least 2 characters').max(100),
  code: z.string().min(2, 'Code must be at least 2 characters').max(50),
  location: z.string().min(2, 'Location is required').max(255),
  parent_id: z.string().uuid('Invalid parent warehouse ID').optional().nullable(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();
