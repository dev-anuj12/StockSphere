import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  code: z.string().min(2, 'Code must be at least 2 characters').max(50),
  description: z.string().optional().nullable(),
  parent_id: z.string().uuid('Invalid parent category ID').optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();
