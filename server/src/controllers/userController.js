import * as userService from '../services/userService.js';
import { z } from 'zod';

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2),
  role: z.enum(['admin', 'manager', 'staff']),
  status: z.enum(['active', 'inactive']).optional(),
  warehouse_ids: z.array(z.string().uuid()).optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'staff']).optional(),
  password: z.string().min(8).optional().nullable(),
  warehouse_ids: z.array(z.string().uuid()).optional(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export async function list(req, res, next) {
  try {
    const { page = 1, limit = 10, sort = 'created_at', order = 'DESC', search = '' } = req.query;
    const result = await userService.listUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      order,
      search,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const validated = createUserSchema.parse(req.body);
    const user = await userService.createUser(validated, req.user.id);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const validated = updateUserSchema.parse(req.body);
    const updated = await userService.updateUser(req.params.id, validated, req.user.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const validated = statusSchema.parse(req.body);
    const updated = await userService.updateUserStatus(req.params.id, validated.status, req.user.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
