import * as supplierService from '../services/supplierService.js';
import { z } from 'zod';

const createSupplierSchema = z.object({
  name: z.string().min(2, 'Supplier name required'),
  code: z.string().min(2, 'Supplier code required'),
  contact_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const updateSupplierSchema = createSupplierSchema.partial();

export async function list(req, res, next) {
  try {
    const status = req.query.status || 'active';
    const suppliers = await supplierService.listSuppliers(status === 'all' ? null : status);
    res.status(200).json({ data: suppliers });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    res.status(200).json(supplier);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const validated = createSupplierSchema.parse(req.body);
    const supplier = await supplierService.createSupplier(validated, req.user.id);
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const validated = updateSupplierSchema.parse(req.body);
    const updated = await supplierService.updateSupplier(req.params.id, validated, req.user.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
