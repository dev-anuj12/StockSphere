import { z } from 'zod';

export const stockInSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  warehouse_id: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reference_no: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const stockOutSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  warehouse_id: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reference_no: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const transferSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  source_warehouse_id: z.string().uuid('Invalid source warehouse ID'),
  destination_warehouse_id: z.string().uuid('Invalid destination warehouse ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reference_no: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(data => data.source_warehouse_id !== data.destination_warehouse_id, {
  message: 'Source and destination warehouses must be different',
  path: ['destination_warehouse_id'],
});

export const adjustmentSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  warehouse_id: z.string().uuid('Invalid warehouse ID'),
  counted_quantity: z.number().int().min(0, 'Counted quantity must be non-negative'),
  reason: z.string().min(3, 'Adjustment reason is required (minimum 3 characters)'),
  notes: z.string().optional().nullable(),
});
